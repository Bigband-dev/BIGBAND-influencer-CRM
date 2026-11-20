#!/usr/bin/env python3
"""Restricted CRM recovery worker. Never updates/deletes existing records.

The worker reads a previously-authorized restore job from Supabase, verifies a
Google Drive encrypted backup, previews selected public records, or executes a
single insert-only PostgreSQL transaction with strict dependency checks.
"""
import base64
import hashlib
import io
import json
import os
import re
import tarfile
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

import psycopg
from psycopg import sql
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from decrypt_backup import decrypt

PARENTS = ('influencers', 'campaigns')
ORDER = ('influencers', 'campaigns', 'influencer_channels', 'influencer_channel_rates', 'campaign_influencers')
BACKUP_NAME = re.compile(r'^crm_supabase_\d{8}T\d{6}\+0900\.tar\.gz\.enc$')
COPY_HEAD = re.compile(r'^COPY public\.([a-z_]+) \(([^)]+)\) FROM stdin;$')
ALLOWED = set(ORDER)
JOB_ID = os.environ['RESTORE_JOB_ID']
JOB_UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f-]{27,}$', re.I)
if not JOB_UUID.fullmatch(JOB_ID):
    raise RuntimeError('Invalid restore job ID')
URL = os.environ['NEXT_PUBLIC_SUPABASE_URL'].rstrip('/') + '/rest/v1/crm_restore_jobs'
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
HEADERS = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json'}


def rest(method, query, payload=None, prefer=None):
    headers = dict(HEADERS)
    if prefer:
        headers['Prefer'] = prefer
    body = None if payload is None else json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(URL + '?id=eq.' + JOB_ID + (query or ''), data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    return json.loads(raw) if raw else []


def patch(fields):
    return rest('PATCH', '', fields, 'return=representation')


def load_job():
    rows = rest('GET', '&select=*')
    if len(rows) != 1 or rows[0]['status'] != 'queued':
        raise RuntimeError('Restore job missing or no longer queued')
    job = rows[0]
    if job['mode'] not in ('preview', 'apply'):
        raise RuntimeError('Unknown job mode')
    if job['mode'] == 'apply':
        source_id = job.get('source_preview_id')
        if not source_id or not JOB_UUID.fullmatch(source_id):
            raise RuntimeError('Missing preview source')
        req = urllib.request.Request(URL + '?id=eq.' + source_id + '&select=*', headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as response:
            previous = json.load(response)
        if len(previous) != 1 or previous[0]['status'] != 'ready' or previous[0]['requested_by'] != job['requested_by'] or previous[0]['backup_id'] != job['backup_id']:
            raise RuntimeError('Preview mismatch or not ready')
        eligible = {(row['table'], row['id']) for row in (previous[0].get('preview') or []) if row.get('status') == 'missing'}
        for table, selected in (job.get('selection') or {}).items():
            if table not in PARENTS or any((table, item) not in eligible for item in selected):
                raise RuntimeError('Selection not confirmed by preview')
    return job


def drive_client():
    raw = base64.b64decode(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON_B64'], validate=True)
    creds = service_account.Credentials.from_service_account_info(json.loads(raw), scopes=['https://www.googleapis.com/auth/drive.readonly'])
    return build('drive', 'v3', credentials=creds, cache_discovery=False)


def get_archive(backup_id, workdir):
    folder = os.environ['GOOGLE_DRIVE_FOLDER_ID']
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,256}', backup_id):
        raise ValueError('Bad backup ID')
    drive = drive_client()
    metadata = drive.files().get(fileId=backup_id, supportsAllDrives=True, fields='id,name,size,parents').execute()
    if folder not in metadata.get('parents', []) or not BACKUP_NAME.fullmatch(metadata.get('name', '')):
        raise ValueError('Selected file is not an authorized CRM backup')
    encrypted = workdir / 'backup.enc'
    downloaded = drive.files().get_media(fileId=backup_id, supportsAllDrives=True)
    with encrypted.open('wb') as out:
        loader = MediaIoBaseDownload(out, downloaded, chunksize=1024 * 1024)
        done = False
        while not done:
            _, done = loader.next_chunk(num_retries=3)
    if encrypted.stat().st_size != int(metadata['size']):
        raise ValueError('Incomplete backup download')
    plaintext = workdir / 'backup.tar.gz'
    key = base64.b64decode(os.environ['BACKUP_ENCRYPTION_KEY_B64'], validate=True)
    if len(key) != 32:
        raise ValueError('Invalid encryption key')
    decrypt(encrypted, plaintext, key)
    with tarfile.open(plaintext, 'r:gz') as archive:
        members = archive.getmembers()
        expected = {'data.sql', 'roles.sql', 'schema.sql', 'manifest.json'}
        if {m.name for m in members} != expected or any(not m.isfile() for m in members):
            raise ValueError('Invalid backup archive members')
        manifest = json.load(archive.extractfile('manifest.json'))
        for name in ['roles.sql', 'schema.sql', 'data.sql']:
            source = archive.extractfile(name)
            digest = hashlib.sha256()
            total = 0
            with (workdir / name).open('wb') as dest:
                for block in iter(lambda: source.read(1024 * 1024), b''):
                    digest.update(block)
                    total += len(block)
                    dest.write(block)
            meta = manifest['files'][name]
            if digest.hexdigest() != meta['sha256'] or total != int(meta['size']):
                raise ValueError('Backup checksum mismatch: ' + name)
    return workdir / 'data.sql'


def unescape_copy(value):
    if value == r'\N':
        return None
    result = []
    i = 0
    mapping = {'b': '\b', 'f': '\f', 'n': '\n', 'r': '\r', 't': '\t', 'v': '\v', '\\': '\\'}
    while i < len(value):
        if value[i] != '\\' or i + 1 >= len(value):
            result.append(value[i]); i += 1; continue
        code = value[i + 1]
        if code in mapping:
            result.append(mapping[code]); i += 2
        elif code in '01234567':
            chunk = re.match(r'[0-7]{1,3}', value[i + 1:]).group()
            result.append(chr(int(chunk, 8))); i += 1 + len(chunk)
        elif code == 'x' and i + 3 < len(value) and re.fullmatch('[0-9a-fA-F]{2}', value[i + 2:i + 4]):
            result.append(chr(int(value[i + 2:i + 4], 16))); i += 4
        else:
            # PostgreSQL COPY treats an unknown escape as the escaped character.
            result.append(code); i += 2
    return ''.join(result)


def load_tables(path):
    tables = {t: [] for t in ORDER}
    current = None
    cols = []
    with path.open('r', encoding='utf-8') as file:
        for line in file:
            line = line.rstrip('\n').rstrip('\r')
            if current is not None:
                if line == r'\.':
                    current = None
                    continue
                values = line.split('\t')
                if len(values) != len(cols):
                    raise ValueError('Malformed COPY line for ' + current)
                row = dict(zip(cols, (unescape_copy(v) for v in values)))
                if not row.get('id'):
                    raise ValueError('Missing row ID')
                tables[current].append(row)
                continue
            match = COPY_HEAD.fullmatch(line)
            if match and match.group(1) in ALLOWED:
                current = match.group(1)
                cols = [c.strip().strip('"') for c in match.group(2).split(',')]
                if len(cols) != len(set(cols)) or 'id' not in cols:
                    raise ValueError('Invalid COPY columns for ' + current)
    if current:
        raise ValueError('Truncated COPY block')
    if not any(tables.values()):
        raise ValueError('No eligible public CRM table data found. Check Supabase dump format.')
    return tables


def preview(conn, tables):
    result = []
    with conn.cursor() as cur:
        for table in PARENTS:
            rows = tables[table]
            ids = [x['id'] for x in rows]
            if len(set(ids)) != len(ids):
                raise ValueError('Duplicate IDs in backup')
            existing = set()
            for start in range(0, len(ids), 300):
                cur.execute(sql.SQL('SELECT id::text FROM public.{} WHERE id::text = ANY(%s)').format(sql.Identifier(table)), (ids[start:start + 300],))
                existing.update(x[0] for x in cur.fetchall())
            for row in rows:
                result.append({'table': table, 'id': row['id'],
                               'name': (row.get('name') or row['id'])[:150],
                               'status': 'exists' if row['id'] in existing else 'missing'})
    if len(result) > 25000:
        raise ValueError('Preview too large')
    return result


def relevant_rows(tables, selection):
    ids = {t: set() for t in ORDER}
    ids['influencers'] = set(selection.get('influencers', []))
    ids['campaigns'] = set(selection.get('campaigns', []))
    source = {t: {r['id']: r for r in tables[t]} for t in ORDER}
    for table in PARENTS:
        if not ids[table].issubset(source[table]):
            raise ValueError('Selected ID not present in original backup')
    for row in tables['influencer_channels']:
        if row['influencer_id'] in ids['influencers']:
            ids['influencer_channels'].add(row['id'])
    for row in tables['influencer_channel_rates']:
        if row['channel_id'] in ids['influencer_channels']:
            ids['influencer_channel_rates'].add(row['id'])
    for row in tables['campaign_influencers']:
        if row['campaign_id'] in ids['campaigns'] or row['influencer_id'] in ids['influencers']:
            ids['campaign_influencers'].add(row['id'])
    return {t: [source[t][k] for k in ids[t]] for t in ORDER}


def apply_insert_only(conn, tables, selection):
    chosen = relevant_rows(tables, selection)
    if not chosen['influencers'] and not chosen['campaigns']:
        raise ValueError('No parent rows selected')
    outcome = {}
    # Single transaction: fail closed on any collision/schema mismatch/FK.
    with conn.transaction():
        with conn.cursor() as cur:
            # Enforce no rows with matching primary keys, before any insert.
            for table in ORDER:
                rows = chosen[table]
                if not rows:
                    continue
                ids = [r['id'] for r in rows]
                if len(ids) != len(set(ids)):
                    raise ValueError('Duplicate child ID in backup')
                cur.execute(sql.SQL('SELECT id::text FROM public.{} WHERE id::text = ANY(%s)').format(sql.Identifier(table)), (ids,))
                if cur.fetchone():
                    raise ValueError('An entry already exists in the live CRM; nothing was changed. Re-run preview.')
                # No schema drift: refuse unknown columns / generated columns.
                cur.execute('SELECT column_name, is_generated, is_identity FROM information_schema.columns WHERE table_schema=%s AND table_name=%s', ('public', table))
                allowed = {name for name, generated, identity in cur.fetchall() if generated == 'NEVER' and identity == 'NO'}
                if not allowed or any(set(r) != set(rows[0]) or not set(r).issubset(allowed) for r in rows):
                    raise ValueError('Schema changed since the backup; manual review required for ' + table)
            # Parent records first, then related child records; FK violations roll back everything.
            for table in ORDER:
                rows = chosen[table]
                if not rows:
                    continue
                cols = list(rows[0])
                q = sql.SQL('INSERT INTO public.{} ({}) VALUES ({})').format(
                    sql.Identifier(table),
                    sql.SQL(', ').join(map(sql.Identifier, cols)),
                    sql.SQL(', ').join(sql.Placeholder() for _ in cols))
                cur.executemany(q, [[r[c] for c in cols] for r in rows])
                outcome[table] = len(rows)
    return outcome


def main():
    job = load_job()
    patch({'status': 'running', 'error': None})
    try:
        with tempfile.TemporaryDirectory(prefix='crm-restore-') as dirname:
            data_path = get_archive(job['backup_id'], Path(dirname))
            tables = load_tables(data_path)
            # Transactional DB access, never run arbitrary SQL from the backup.
            with psycopg.connect(os.environ['SUPABASE_DB_URL'], autocommit=False, connect_timeout=20) as conn:
                if job['mode'] == 'preview':
                    rows = preview(conn, tables)
                    patch({'status': 'ready', 'preview': rows, 'result': {'items': len(rows)}})
                else:
                    if os.environ.get('CRM_RESTORE_APPLY_ENABLED') != 'true':
                        raise RuntimeError('Live apply disabled. Enable repository secret CRM_RESTORE_APPLY_ENABLED=true after preview testing.')
                    if job.get('confirmation') != 'RESTORE' or not job.get('selection'):
                        raise RuntimeError('Restore confirmation or selection missing')
                    result = apply_insert_only(conn, tables, job['selection'])
                    conn.commit()  # Commit before reporting success to the UI.
                    patch({'status': 'completed', 'result': result})
        print('Job finished: ' + job['mode'])
    except Exception as ex:
        # Don't print user data or credentials in the action logs.
        msg = str(ex)
        # Database drivers may echo host/user metadata. Never expose connection secrets.
        for secret_name in ('SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_SERVICE_ACCOUNT_JSON_B64', 'BACKUP_ENCRYPTION_KEY_B64'):
            secret = os.environ.get(secret_name, '')
            if secret:
                msg = msg.replace(secret, '[REDACTED]')
        if 'password authentication' in msg.lower() or 'connection failed' in msg.lower():
            msg = 'Database connection failed; check GitHub Supabase DB secret and pooler settings'
        patch({'status': 'failed', 'error': msg[:400]})
        raise RuntimeError('Restore job failed: ' + msg[:250]) from None


if __name__ == '__main__':
    main()
