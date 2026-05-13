"""
migrate_add_roles.py — Run once against an existing clarity.db
to add the `role` and `client_id` columns to the `users` table.

Usage (from backend/):
    python migrate_add_roles.py

Safe to run multiple times — checks whether the columns already exist first.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "clarity.db")


def column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def run():
    print(f"Opening database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cur  = conn.cursor()

    # ── Add `role` column ───────────────────────────────────────────────────
    if column_exists(cur, "users", "role"):
        print("  ✓ Column `role` already exists — skipping")
    else:
        cur.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'")
        print("  + Added column `role` (default='admin' so existing users become admins)")

    # ── Add `client_id` column ──────────────────────────────────────────────
    if column_exists(cur, "users", "client_id"):
        print("  ✓ Column `client_id` already exists — skipping")
    else:
        cur.execute("ALTER TABLE users ADD COLUMN client_id INTEGER REFERENCES clients(id)")
        print("  + Added column `client_id` (nullable FK → clients)")

    conn.commit()
    conn.close()
    print("\nMigration complete.")
    print("Existing users now have role='admin'.")
    print("New client users created via /api/admin/clients/{id}/users will have role='client'.")


if __name__ == "__main__":
    run()
