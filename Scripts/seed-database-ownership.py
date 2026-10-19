#!/usr/bin/env python3
"""Seed approved local hub ownership into a DEV or FIT SQLite database."""
from __future__ import annotations

import argparse
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

TABLES = (
    "Addresses", "Education", "Employment", "BudgetCategories",
    "BudgetSubcategories", "Transactions", "EmojiLabelDefinitions",
    "FileMetadata", "ForgeKeeper", "GemHues", "GemHueImages",
    "HomeInventory", "Services", "ServiceLogoAssets",
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("database", type=Path)
    parser.add_argument("--hub-id", required=True)
    parser.add_argument("--backup-directory", type=Path, required=True)
    parser.add_argument("--confirm-ownership-seed", action="store_true")
    args = parser.parse_args()

    database = args.database.resolve()
    if not args.confirm_ownership_seed:
        raise SystemExit("refusing to write: add --confirm-ownership-seed after review")
    if database.name not in {"GemLife_DB_dev.sqlite", "GemLife_DB_fit.sqlite"}:
        raise SystemExit("target must be GemLife_DB_dev.sqlite or GemLife_DB_fit.sqlite")
    if not database.is_file():
        raise SystemExit("target database does not exist")

    args.backup_directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = args.backup_directory / f"{database.stem}-before-ownership-{stamp}.sqlite"
    shutil.copy2(database, backup)
    if backup.stat().st_size != database.stat().st_size:
        raise SystemExit("backup verification failed")

    connection = sqlite3.connect(database)
    try:
        connection.execute("BEGIN IMMEDIATE")
        counts: dict[str, int] = {}
        for table in TABLES:
            columns = {row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')}
            if "HubID" not in columns:
                continue
            connection.execute(f'UPDATE "{table}" SET "HubID" = ?', (args.hub_id,))
            counts[table] = connection.execute(
                f'SELECT COUNT(*) FROM "{table}" WHERE "HubID" = ?', (args.hub_id,)
            ).fetchone()[0]
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

    print(f"status=updated-and-verified backup={backup}")
    for table, count in counts.items():
        print(f"verified {table} rows={count}")


if __name__ == "__main__":
    main()
