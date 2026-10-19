#!/usr/bin/env python3
"""Create a deterministic, backup-first database synchronization plan."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

TABLES = ("Addresses", "Domains", "Education", "Employment", "Transactions", "Services", "FileMetadata", "ForgeKeeper", "GemHues", "HomeInventory")
ALLOWED_TARGET_COLUMNS = {"HubID"}

def columns(db: sqlite3.Connection, table: str) -> list[tuple[str, int]]:
    return [(r[1], r[5]) for r in db.execute(f'PRAGMA table_info("{table}")')]

def rows(db: sqlite3.Connection, table: str, names: list[str]) -> list[tuple]:
    quoted = ", ".join(f'"{name}"' for name in names)
    return list(db.execute(f'SELECT {quoted} FROM "{table}"'))

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("dev", type=Path)
    parser.add_argument("fit", type=Path)
    parser.add_argument("backup_directory", type=Path)
    parser.add_argument("--asset-directory", type=Path)
    args = parser.parse_args()
    paths = [p.resolve() for p in (args.source, args.dev, args.fit)]
    if len(set(paths)) != 3:
        raise SystemExit("source and targets must be three different files")
    if paths[1].name != "GemLife_DB_dev.sqlite" or paths[2].name != "GemLife_DB_fit.sqlite":
        raise SystemExit("targets must be GemLife_DB_dev.sqlite and GemLife_DB_fit.sqlite")
    if not all(p.is_file() for p in paths):
        raise SystemExit("all database files must exist")

    args.backup_directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backups = {}
    for label, target in (("dev", paths[1]), ("fit", paths[2])):
        backup = args.backup_directory / f"{target.stem}-before-sync-{stamp}.sqlite"
        shutil.copy2(target, backup)
        if backup.stat().st_size != target.stat().st_size:
            raise SystemExit(f"backup verification failed: {backup}")
        backups[label] = str(backup)

    connections = [sqlite3.connect(str(p)) for p in paths]
    try:
        source, dev, fit = connections
        plan = {"version": 1, "status": "preview", "target_writes": 0, "source": str(paths[0]), "targets": {"dev": str(paths[1]), "fit": str(paths[2])}, "backups": backups, "tables": [], "schema_mismatches": []}
        for table in TABLES:
            source_cols = columns(source, table)
            if not source_cols:
                continue
            source_names = [name for name, _ in source_cols]
            source_pk = [name for name, pk in source_cols if pk]
            if not source_pk:
                continue
            entry = {"table": table, "primary_key": source_pk, "targets": {}}
            source_map = {tuple(row[i] for i, name in enumerate(source_names) if name in source_pk): row for row in rows(source, table, source_names)}
            for label, target in (("dev", dev), ("fit", fit)):
                target_cols = columns(target, table)
                target_names = [name for name, _ in target_cols]
                missing = [name for name in source_names if name not in target_names]
                unexpected = [name for name in target_names if name not in source_names and name not in ALLOWED_TARGET_COLUMNS]
                if missing or unexpected:
                    plan["schema_mismatches"].append({"target": label, "table": table, "missing": missing, "unexpected": unexpected})
                    continue
                common = [name for name in source_names if name in target_names]
                target_rows = rows(target, table, common)
                key_indexes = [common.index(name) for name in source_pk]
                target_map = {tuple(row[i] for i in key_indexes): row for row in target_rows}
                inserts = sorted(set(source_map) - set(target_map), key=str)
                target_only = sorted(set(target_map) - set(source_map), key=str)
                updates = 0
                conflicts = 0
                for key in set(source_map) & set(target_map):
                    source_row = tuple(source_map[key][source_names.index(name)] for name in common)
                    if source_row != target_map[key]:
                        updates += 1
                        conflicts += 1
                entry["targets"][label] = {"source_rows": len(source_map), "target_rows": len(target_map), "inserts": len(inserts), "updates": updates, "target_only": len(target_only), "conflicts": conflicts}
            plan["tables"].append(entry)
        if plan["schema_mismatches"]:
            plan["status"] = "blocked-schema-mismatch"
        plan_path = args.backup_directory / f"database-sync-plan-{stamp}.json"
        plan_path.write_text(json.dumps(plan, indent=2, sort_keys=True) + "\n")
        print(json.dumps(plan, indent=2, sort_keys=True))
        return 65 if plan["schema_mismatches"] else 0
    finally:
        for db in connections:
            db.close()

if __name__ == "__main__":
    sys.exit(main())
