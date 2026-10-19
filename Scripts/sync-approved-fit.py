#!/usr/bin/env python3
"""Apply the approved rebuild -> fit sync with an explicit ownership transform."""
from __future__ import annotations
import argparse, shutil, sqlite3, sys
from datetime import datetime, timezone
from pathlib import Path

TABLES = ("Addresses", "Domains", "Education", "Employment", "Transactions", "Services", "FileMetadata", "ForgeKeeper", "GemHues", "HomeInventory")

def cols(db, table):
    return [r[1] for r in db.execute(f'PRAGMA table_info("{table}")')]

def main():
    p = argparse.ArgumentParser()
    p.add_argument("source", type=Path); p.add_argument("target", type=Path); p.add_argument("backup_directory", type=Path)
    p.add_argument("--hub-id", required=True); p.add_argument("--confirm-fit-sync", action="store_true")
    a = p.parse_args(); source, target = a.source.resolve(), a.target.resolve()
    if not a.confirm_fit_sync: raise SystemExit("refusing to write: add --confirm-fit-sync after reviewing the approved plan")
    if source == target or target.name != "GemLife_DB_fit.sqlite": raise SystemExit("target must be GemLife_DB_fit.sqlite and differ from source")
    if not source.is_file() or not target.is_file(): raise SystemExit("source and target database files must exist")
    a.backup_directory.mkdir(parents=True, exist_ok=True); stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = a.backup_directory / f"GemLife_DB_fit-before-approved-sync-{stamp}.sqlite"; shutil.copy2(target, backup)
    if backup.stat().st_size != target.stat().st_size: raise SystemExit("backup verification failed")
    src, dst = sqlite3.connect(source), sqlite3.connect(target)
    try:
        dst.execute("PRAGMA foreign_keys=ON"); dst.execute("BEGIN IMMEDIATE")
        counts = {}
        for table in TABLES:
            source_cols = cols(src, table); target_cols = cols(dst, table)
            missing = [c for c in source_cols if c not in target_cols]
            if missing: raise RuntimeError(f"schema mismatch in {table}: missing {missing}")
            if "HubID" not in target_cols:
                dst.execute(f'ALTER TABLE "{table}" ADD COLUMN "HubID" TEXT')
                target_cols.append("HubID")
            names = [c for c in source_cols if c != "HubID"]; quoted = ", ".join(f'"{c}"' for c in names)
            rows = list(src.execute(f'SELECT {quoted} FROM "{table}"'))
            dst.execute(f'DELETE FROM "{table}"'); marks = ", ".join("?" for _ in names)
            dst.executemany(f'INSERT INTO "{table}" ({quoted}) VALUES ({marks})', rows)
            dst.execute(f'UPDATE "{table}" SET "HubID" = ?', (a.hub_id,)); counts[table] = len(rows)
        dst.commit()
        for table, expected in counts.items():
            actual = dst.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            if actual != expected: raise RuntimeError(f"post-sync verification failed for {table}")
        print(f"status=updated-and-verified backup={backup}")
        for table, count in counts.items(): print(f"verified {table} rows={count}")
    except Exception:
        dst.rollback(); raise
    finally: src.close(); dst.close()

if __name__ == "__main__":
    try: main()
    except Exception as e: print(f"sync failed: {e}", file=sys.stderr); sys.exit(65)
