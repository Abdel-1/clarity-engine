"""
DB migration — run once on startup via main.py.
Adds new columns to existing SQLite tables (ALTER TABLE IF NOT EXISTS pattern).
Safe to re-run: each ALTER TABLE is wrapped in try/except.
"""
from sqlalchemy import text
from app.db.session import engine


def run_migrations():
    with engine.connect() as conn:
        _add_column(conn, "analyses",  "parent_analysis_id", "INTEGER REFERENCES analyses(id)")
        _add_column(conn, "users",     "role",               "VARCHAR DEFAULT 'client'")
        _add_column(conn, "users",     "client_id",          "INTEGER")
        # Promote admin@clarity.com to admin role
        conn.execute(text(
            "UPDATE users SET role = 'admin' WHERE email = 'admin@clarity.com'"
        ))
        conn.commit()


def _add_column(conn, table: str, column: str, col_type: str):
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        conn.commit()
    except Exception:
        pass  # Column already exists — safe to ignore
