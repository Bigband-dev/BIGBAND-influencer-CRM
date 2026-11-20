#!/usr/bin/env python3
"""Read encrypted CRM backup from Shared Drive, verify GCM tag, tar members and SHA256.
Does NOT connect to or modify any database. Never uploads plaintext artifacts.
"""
import base64
import hashlib
import json
import os
import re
import tarfile
import tempfile
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from decrypt_backup import decrypt

NAMES = {'roles.sql', 'schema.sql', 'data.sql', 'manifest.json'}


def required(name):
    value = os.environ.get(name, '').strip()
    if not value:
        raise RuntimeError(f'Missing environment variable {name}')
    return value


def main():
    backup_id = required('BACKUP_FILE_ID')
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,256}', backup_id):
        raise ValueError('Invalid Drive file ID')
    folder_id = required('GOOGLE_DRIVE_FOLDER_ID')
    creds_info = json.loads(base64.b64decode(required('GOOGLE_SERVICE_ACCOUNT_JSON_B64'), validate=True))
    creds = service_account.Credentials.from_service_account_info(
        creds_info, scopes=['https://www.googleapis.com/auth/drive.readonly'])
    drive = build('drive', 'v3', credentials=creds, cache_discovery=False)
    metadata = drive.files().get(fileId=backup_id, fields='id,name,parents,size', supportsAllDrives=True).execute()
    if folder_id not in metadata.get('parents', []):
        raise ValueError('Backup file is outside the configured folder')
    if not re.fullmatch(r'crm_supabase_\d{8}T\d{6}\+0900\.tar\.gz\.enc', metadata['name']):
        raise ValueError('Not an expected CRM encrypted backup')
    key = base64.b64decode(required('BACKUP_ENCRYPTION_KEY_B64'), validate=True)
    if len(key) != 32:
        raise ValueError('Invalid encryption key length')

    with tempfile.TemporaryDirectory(prefix='crm-backup-verify-') as tmp:
        encrypted = Path(tmp) / 'backup.enc'
        plaintext = Path(tmp) / 'backup.tar.gz'
        request = drive.files().get_media(fileId=backup_id, supportsAllDrives=True)
        with encrypted.open('wb') as stream:
            downloader = MediaIoBaseDownload(stream, request, chunksize=1024 * 1024)
            done = False
            while not done:
                _, done = downloader.next_chunk(num_retries=3)
        if encrypted.stat().st_size != int(metadata['size']):
            raise ValueError('Downloaded file size mismatch')
        decrypt(encrypted, plaintext, key)
        with tarfile.open(plaintext, 'r:gz') as archive:
            members = archive.getmembers()
            if {x.name for x in members} != NAMES:
                raise ValueError('Unexpected or missing files in archive')
            if any(not x.isfile() for x in members):
                raise ValueError('Invalid archive member type')
            manifest = json.load(archive.extractfile('manifest.json'))
            for name in ('roles.sql', 'schema.sql', 'data.sql'):
                info = manifest['files'][name]
                sha = hashlib.sha256()
                count = 0
                with archive.extractfile(name) as reader:
                    for chunk in iter(lambda: reader.read(1024 * 1024), b''):
                        sha.update(chunk)
                        count += len(chunk)
                if count != int(info['size']) or sha.hexdigest() != info['sha256']:
                    raise ValueError(f'Integrity verification failed for {name}')
                print(f'VALID {name}: {count} bytes, SHA256 matched')
    print('Backup decryption and archive integrity checks PASSED. No database was modified.')


if __name__ == '__main__':
    main()
