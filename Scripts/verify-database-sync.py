#!/usr/bin/env python3
"""Read-only verification for rebuild, dev, and fit SQLite databases."""
from __future__ import annotations
import argparse, hashlib, json, sqlite3, sys
from pathlib import Path

TABLES = ("Addresses", "Domains", "Education", "Employment", "Transactions", "Services", "FileMetadata", "ForgeKeeper", "GemHues", "HomeInventory")

def digest(db, table):
    rows = db.execute(f'SELECT * FROM "{table}" ORDER BY 1').fetchall()
    encoded = json.dumps(rows, default=str, separators=(",", ":")).encode()
    return len(rows), hashlib.sha256(encoded).hexdigest()

def main():
    p = argparse.ArgumentParser(); p.add_argument("source", type=Path); p.add_argument("dev", type=Path); p.add_argument("fit", type=Path); p.add_argument("--backup-directory", type=Path, action="append", default=[])
    a = p.parse_args(); paths = [a.source.resolve(), a.dev.resolve(), a.fit.resolve()]
    if len(set(paths)) != 3 or not all(x.is_file() for x in paths): raise SystemExit("three distinct existing database files are required")
    dbs = [sqlite3.connect(x) for x in paths]
    try:
        result = {"status": "verified", "source": str(paths[0]), "databases": {}, "backups": []}
        for label, db in zip(("source", "dev", "fit"), dbs):
            result["databases"][label] = {table: digest(db, table) for table in TABLES}
        for table in TABLES:
            source_count, source_hash = result["databases"]["source"][table]
            for label in ("dev", "fit"):
                count, table_hash = result["databases"][label][table]
                if count != source_count: result["status"] = "failed"
        for label, db in zip(("dev", "fit"), dbs[1:]):
            cols = [r[1] for r in db.execute('PRAGMA table_info("Addresses")')]
            if "HubID" in cols:
                unowned = db.execute('SELECT COUNT(*) FROM Addresses WHERE HubID IS NULL').fetchone()[0]
                result["databases"][label]["ownership"] = {"unowned_addresses": unowned}
                if unowned: result["status"] = "failed"
            else: result["databases"][label]["ownership"] = {"status": "missing-HubID"}
            result["databases"][label]["attachment_references"] = db.execute("SELECT COUNT(*) FROM FileMetadata").fetchone()[0]
        for directory in a.backup_directory:
            if not directory.is_dir(): result["status"] = "failed"; continue
            files = sorted(str(x) for x in directory.glob("*.sqlite") if x.is_file())
            result["backups"].append({"directory": str(directory), "sqlite_files": files})
            if not files: result["status"] = "failed"
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0 if result["status"] == "verified" else 65
    finally:
        for db in dbs: db.close()

if __name__ == "__main__": sys.exit(main())
