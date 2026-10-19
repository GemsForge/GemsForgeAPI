#!/usr/bin/env python3
"""Apply an approved rebuild -> dev synchronization with a verified rollback copy."""
from __future__ import annotations

import argparse
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

TABLES = ("Addresses", "Domains", "Education", "Employment", "Transactions", "Services", "FileMetadata", "ForgeKeeper", "GemHues", "HomeInventory")
EXCLUDED = {"Accounts", "AccountIdentities", "AuthenticationSessions", "Hubs", "SchemaMigrationAudits", "_fluent_migrations"}

def table_columns(db: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in db.execute(f'PRAGMA table_info("{table}")')]

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("backup_directory", type=Path)
    parser.add_argument("--hub-id", required=True)
    parser.add_argument("--confirm-dev-sync", action="store_true")
    args = parser.parse_args()
    source, target = args.source.resolve(), args.target.resolve()
    if not args.confirm_dev_sync:
        raise SystemExit("refusing to write: add --confirm-dev-sync after reviewing the approved plan")
    if source == target or target.name != "GemLife_DB_dev.sqlite":
        raise SystemExit("source and target must be different, and target must be GemLife_DB_dev.sqlite")
    if not source.is_file() or not target.is_file():
        raise SystemExit("source and target database files must exist")

    args.backup_directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = args.backup_directory / f"GemLife_DB_dev-before-approved-sync-{stamp}.sqlite"
    shutil.copy2(target, backup)
    if backup.stat().st_size != target.stat().st_size:
        raise SystemExit(f"backup verification failed: {backup}")

    src = sqlite3.connect(str(source))
    dst = sqlite3.connect(str(target))
    try:
        dst.execute("PRAGMA foreign_keys=ON")
        dst.execute("BEGIN IMMEDIATE")
        counts = {}
        for table in TABLES:
            source_columns = table_columns(src, table)
            target_columns = table_columns(dst, table)
            missing = [c for c in source_columns if c not in target_columns]
            if missing:
                raise RuntimeError(f"schema mismatch in {table}: target is missing {missing}")
            managed_columns = [c for c in source_columns if c != "HubID"]
            if not managed_columns:
                continue
            quoted = ", ".join(f'"{c}"' for c in managed_columns)
            rows = list(src.execute(f'SELECT {quoted} FROM "{table}"'))
            dst.execute(f'DELETE FROM "{table}"')
            placeholders = ", ".join("?" for _ in managed_columns)
            dst.executemany(f'INSERT INTO "{table}" ({quoted}) VALUES ({placeholders})', rows)
            if "HubID" in target_columns:
                dst.execute(f'UPDATE "{table}" SET "HubID" = ?', (args.hub_id,))
            counts[table] = len(rows)
        dst.commit()
        for table, expected in counts.items():
            actual = dst.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            if actual != expected:
                raise RuntimeError(f"post-sync verification failed for {table}: expected {expected}, got {actual}")
        print(f"status=updated-and-verified backup={backup}")
        for table, count in counts.items():
            print(f"verified {table} rows={count}")
        return 0
    except Exception:
        dst.rollback()
        raise
    finally:
        src.close()
        dst.close()

if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"sync failed: {error}", file=sys.stderr)
        sys.exit(65)
