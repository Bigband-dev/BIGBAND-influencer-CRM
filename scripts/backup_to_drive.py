#!/usr/bin/env python3
"""Supabase CLI backup -> tar.gz -> AES-256-GCM -> Google shared Drive -> rotate.

This script requires GOOGLE_DRIVE_FOLDER_ID to refer to a folder in a Workspace
Shared Drive, writable by the service account. It intentionally does not use
public GitHub artifacts to store plaintext backup data.
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import io
import json
import os
import re
import subprocess
import tarfile
import tempfile
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PREFIX = 'crm_supabase_'
SUFFIX = '.tar.gz.enc'
NAME_RE = re.compile(r'^crm_supabase_\d{8}T\d{6}\+0900\.tar\.gz\.enc$')
MAGIC = b'CRMBAK01'  # 8-byte signature; stream layout = MAGIC + 12-byte IV + ciphertext + 16-byte tag
CHUNK = 1024 * 1024
SCOPES = ['https://www.googleapis.com/auth/drive']


def required(name: str) -> str:
    v = os.environ.get(name, '').strip()
    if not v:
        raise RuntimeError(f'Missing GitHub Actions secret: {name}')
    return v


def decode_key() -> bytes:
    try:
        key = base64.b64decode(required('BACKUP_ENCRYPTION_KEY_B64'), validate=True)
    except Exception as exc:
        raise RuntimeError('BACKUP_ENCRYPTION_KEY_B64 must be base64 of 32 random bytes') from exc
    if len(key) != 32:
        raise RuntimeError('BACKUP_ENCRYPTION_KEY_B64 must decode to exactly 32 bytes')
    return key


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(CHUNK), b''):
            h.update(chunk)
    return h.hexdigest()


def dump(db_url: str, output: Path, *args: str) -> None:
    cmd = ['supabase', 'db', 'dump', f'--remote={db_url}', '-f', str(output), *args]
    # Never print the command because it contains the DB password.
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode:
        stderr = result.stderr.replace(db_url, '[REDACTED_DB_URL]')
        # Prevent leakage of an embedded raw password in error output.
        from urllib.parse import urlsplit, unquote
        try:
            password = urlsplit(db_url).password
            if password:
                stderr = stderr.replace(password, '[REDACTED]')
                stderr = stderr.replace(unquote(password), '[REDACTED]')
        except Exception:
            pass
        raise RuntimeError(f'Supabase dump failed ({output.name}): {stderr[-3000:]}')
    if not output.is_file() or output.stat().st_size == 0:
        raise RuntimeError(f'Dump missing or empty: {output.name}')
    print(f'Created {output.name} ({output.stat().st_size} bytes)')


def archive_dumps(workdir: Path, archive_path: Path, when: dt.datetime) -> None:
    files = [workdir / 'roles.sql', workdir / 'schema.sql', workdir / 'data.sql']
    manifest = {
        'created_at_kst': when.isoformat(),
        'backup_format': 'supabase-cli-role-schema-data',
        'files': {p.name: {'size': p.stat().st_size, 'sha256': sha256(p)} for p in files},
        'notes': 'Logical database backup only; Supabase Storage file bytes and external configuration are not included.'
    }
    manifest_bytes = json.dumps(manifest, indent=2, ensure_ascii=False).encode('utf-8')
    with tarfile.open(archive_path, 'w:gz') as tf:
        for p in files:
            tf.add(p, arcname=p.name)
        info = tarfile.TarInfo('manifest.json')
        info.size = len(manifest_bytes)
        tf.addfile(info, io.BytesIO(manifest_bytes))


def encrypt(source: Path, destination: Path, key: bytes) -> None:
    import secrets
    nonce = secrets.token_bytes(12)
    encryptor = Cipher(algorithms.AES(key), modes.GCM(nonce)).encryptor()
    with source.open('rb') as src, destination.open('wb') as dst:
        dst.write(MAGIC)
        dst.write(nonce)
        for chunk in iter(lambda: src.read(CHUNK), b''):
            dst.write(encryptor.update(chunk))
        dst.write(encryptor.finalize())
        dst.write(encryptor.tag)


def drive_client():
    try:
        raw = base64.b64decode(required('GOOGLE_SERVICE_ACCOUNT_JSON_B64'), validate=True)
        info = json.loads(raw)
        creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    except Exception as exc:
        raise RuntimeError('Invalid GOOGLE_SERVICE_ACCOUNT_JSON_B64 service account credentials') from exc
    return build('drive', 'v3', credentials=creds, cache_discovery=False)


def upload_and_verify(drive, folder_id: str, encrypted: Path) -> str:
    metadata = {'name': encrypted.name, 'parents': [folder_id], 'mimeType': 'application/octet-stream',
                'description': 'AES-256-GCM encrypted Supabase CRM logical database backup'}
    media = MediaFileUpload(str(encrypted), mimetype='application/octet-stream', resumable=True)
    created = drive.files().create(body=metadata, media_body=media,
                                   fields='id,name,size,md5Checksum,parents', supportsAllDrives=True).execute()
    expected_size = encrypted.stat().st_size
    md5 = hashlib.md5()
    with encrypted.open('rb') as fh:
        for chunk in iter(lambda: fh.read(CHUNK), b''):
            md5.update(chunk)
    expected_md5 = md5.hexdigest()
    # Re-fetch metadata to verify server-side size and hash where available.
    uploaded = drive.files().get(fileId=created['id'], fields='id,name,size,md5Checksum,parents',
                                 supportsAllDrives=True).execute()
    if int(uploaded.get('size', -1)) != expected_size:
        raise RuntimeError('Google Drive uploaded file size does not match local encrypted archive')
    if uploaded.get('name') != encrypted.name or folder_id not in uploaded.get('parents', []):
        raise RuntimeError('Google Drive uploaded file metadata mismatch')
    if uploaded.get('md5Checksum') and uploaded['md5Checksum'] != expected_md5:
        raise RuntimeError('Google Drive uploaded file hash mismatch')
    print(f'Uploaded and verified Drive file {uploaded["name"]}, id={uploaded["id"]}, size={expected_size}')
    return uploaded['id']


def rotate(drive, folder_id: str, retain: int, new_id: str) -> None:
    all_files = []
    token = None
    while True:
        res = drive.files().list(
            q=f"'{folder_id}' in parents and trashed = false and name contains '{PREFIX}'",
            fields='nextPageToken,files(id,name,createdTime)', pageSize=1000,
            supportsAllDrives=True, includeItemsFromAllDrives=True,
            pageToken=token,
        ).execute()
        all_files.extend(f for f in res.get('files', []) if NAME_RE.fullmatch(f.get('name', '')))
        token = res.get('nextPageToken')
        if not token:
            break
    all_files.sort(key=lambda x: (x['name'], x.get('createdTime', '')), reverse=True)
    if new_id not in {f['id'] for f in all_files}:
        raise RuntimeError('Newly uploaded backup was not found during Drive listing; refusing deletion')
    # Never delete the freshly uploaded backup, even with unexpected timestamps.
    protected = {new_id}
    keep = {f['id'] for f in all_files[:retain]} | protected
    deleted = 0
    for item in all_files:
        if item['id'] in keep:
            continue
        drive.files().delete(fileId=item['id'], supportsAllDrives=True).execute()
        deleted += 1
    print(f'Retention: {len(all_files)} candidate files, removed {deleted} old backup(s), keeping newest {retain}')


def main() -> None:
    db_url = required('SUPABASE_DB_URL')
    folder_id = required('GOOGLE_DRIVE_FOLDER_ID')
    key = decode_key()
    retain = int(os.environ.get('BACKUP_RETENTION_COUNT', '12'))
    if retain < 1:
        raise RuntimeError('BACKUP_RETENTION_COUNT must be >= 1')
    if '/rest/v1' in db_url or not db_url.startswith(('postgresql://', 'postgres://')):
        raise RuntimeError('SUPABASE_DB_URL must be a PostgreSQL session pooler URI, not the Supabase REST URL')
    when = dt.datetime.now(dt.timezone(dt.timedelta(hours=9)))
    name = f'{PREFIX}{when.strftime("%Y%m%dT%H%M%S+0900")}{SUFFIX}'
    with tempfile.TemporaryDirectory(prefix='crm-db-backup-') as td:
        wd = Path(td)
        dump(db_url, wd / 'roles.sql', '--role-only')
        dump(db_url, wd / 'schema.sql')
        dump(db_url, wd / 'data.sql', '--use-copy', '--data-only', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes')
        archive = wd / name.removesuffix('.enc')
        archive_dumps(wd, archive, when)
        encrypted = wd / name
        encrypt(archive, encrypted, key)
        # Only upload encrypted output. Local plaintext is removed when TemporaryDirectory exits.
        drive = drive_client()
        new_id = upload_and_verify(drive, folder_id, encrypted)
        rotate(drive, folder_id, retain, new_id)
        print('Backup completed successfully.')


if __name__ == '__main__':
    main()
