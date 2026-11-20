#!/usr/bin/env python3
"""Decrypt a .tar.gz.enc backup with BACKUP_ENCRYPTION_KEY_B64.

Usage: python scripts/decrypt_backup.py backup.tar.gz.enc output.tar.gz
Does not extract or restore to a live database.
"""
import base64
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

MAGIC = b'CRMBAK01'
CHUNK = 1024 * 1024


def decrypt(source: Path, dest: Path, key: bytes) -> None:
    size = source.stat().st_size
    if size < len(MAGIC) + 12 + 16:
        raise ValueError('Backup is too small')
    with source.open('rb') as inp:
        if inp.read(8) != MAGIC:
            raise ValueError('Not a CRMBAK01 encrypted backup')
        nonce = inp.read(12)
        inp.seek(size - 16)
        tag = inp.read(16)
        inp.seek(20)
        remaining = size - 20 - 16
        decryptor = Cipher(algorithms.AES(key), modes.GCM(nonce, tag)).decryptor()
        try:
            with dest.open('wb') as out:
                while remaining:
                    chunk = inp.read(min(CHUNK, remaining))
                    if not chunk:
                        raise ValueError('Truncated encrypted backup')
                    remaining -= len(chunk)
                    out.write(decryptor.update(chunk))
                out.write(decryptor.finalize())
        except Exception:
            dest.unlink(missing_ok=True)
            raise


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python scripts/decrypt_backup.py BACKUP.tar.gz.enc OUTPUT.tar.gz')
    key = base64.b64decode(os.environ['BACKUP_ENCRYPTION_KEY_B64'], validate=True)
    if len(key) != 32:
        raise ValueError('The encryption key must be exactly 32 bytes')
    source, dest = Path(sys.argv[1]), Path(sys.argv[2])
    if dest.exists():
        raise FileExistsError(f'Refusing to overwrite existing file: {dest}')
    decrypt(source, dest, key)
    print(f'Decrypted: {dest}')


if __name__ == '__main__':
    main()
