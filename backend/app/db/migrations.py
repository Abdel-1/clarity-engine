"""
DB migration — run once on startup via main.py.
Adds new columns to existing SQLite tables (ALTER TABLE IF NOT EXISTS pattern).
Safe to re-run: each ALTER TABLE is wrapped in try/except.
"""
from sqlalchemy import text
from app.db.session import engine


def run_migrations():
    with engine.connect() as conn:
        # 1. Structural changes
        _add_column(conn, "analyses",      "parent_analysis_id", "INTEGER REFERENCES analyses(id)")
        _add_column(conn, "users",         "role",               "VARCHAR DEFAULT 'membre'")
        _add_column(conn, "users",         "client_id",          "INTEGER")
        _add_column(conn, "analyses",      "conversation_id",    "VARCHAR")
        _add_column(conn, "analyses",      "iteration_index",    "INTEGER DEFAULT 0")
        _add_column(conn, "analyses",      "client_id",          "INTEGER")
        _add_column(conn, "analyses",      "prompt_tokens",      "INTEGER")
        _add_column(conn, "analyses",      "completion_tokens",  "INTEGER")
        _add_column(conn, "analyses",      "total_tokens",       "INTEGER")
        _add_column(conn, "analyses",      "prompt_version",     "VARCHAR")
        _add_column(conn, "analyses",      "brand_system_snapshot", "TEXT")
        _add_column(conn, "analyses",      "analyzed_by_user_id", "INTEGER")
        _add_column(conn, "brand_systems", "client_id",          "INTEGER")
        _add_column(conn, "brand_systems", "is_active",          "BOOLEAN DEFAULT 1")
        # Analysis access switches (admin can suspend the engine per brand / per member)
        _add_column(conn, "brand_systems", "analysis_enabled",   "BOOLEAN DEFAULT 1")
        _add_column(conn, "users",         "analysis_enabled",   "BOOLEAN DEFAULT 1")
        _add_column(conn, "users",         "tokens_valid_after", "DATETIME")
        
        # 2. Role Cleanup
        # SECURITY: do NOT auto-promote any hardcoded email to admin here. A
        # startup that grants 'admin' to a fixed address is a privilege-escalation
        # backdoor (anyone able to register/own that address becomes super admin).
        # Provision the super admin explicitly via the seed script instead
        # (backend/seed_admin.py), with a strong, rotated password.
        #
        # Rename legacy 'client' role to 'membre' (safe, idempotent data fix).
        conn.execute(text(
            "UPDATE users SET role = 'membre' WHERE role = 'client'"
        ))
        
        # 3. Data Integrity & Tenant Visibility Recovery
        # Ensure at least one default client exists if there are orphaned records
        has_orphans = conn.execute(text(
            "SELECT 1 FROM users WHERE client_id IS NULL AND role != 'admin' LIMIT 1"
        )).first()
        
        if has_orphans:
            # Check if we have any client
            client = conn.execute(text("SELECT id FROM clients LIMIT 1")).first()
            if not client:
                # Create a default client
                conn.execute(text("INSERT INTO clients (company_name, sector) VALUES ('Organisation par défaut', 'Général')"))
                conn.commit()
                client = conn.execute(text("SELECT id FROM clients LIMIT 1")).first()
            
            if client:
                cid = client[0]
                # Assign orphans to this client so they become visible in dashboards
                conn.execute(text(f"UPDATE users SET client_id = {cid} WHERE client_id IS NULL AND role != 'admin'"))
                conn.execute(text(f"UPDATE analyses SET client_id = {cid} WHERE client_id IS NULL"))
                conn.execute(text(f"UPDATE brand_systems SET client_id = {cid} WHERE client_id IS NULL"))

        # 3b. Backfill analyzed_by_user_id from the legacy analyzed_by display label
        #     (B2). Authorization now keys off this stable FK, not the spoofable
        #     name string. Runs after client_id is populated above. Idempotent:
        #     only touches still-NULL rows. Two passes, most-precise first —
        #       Pass 1: exact email match (emails are unique → unambiguous)
        #       Pass 2: full_name match, preferring the membre on a same-name tie
        #               (a brand admin sharing the name still sees everything via
        #                client scope, so attributing to the membre preserves the
        #                member's existing per-user view). Verified row-count safe.
        conn.execute(text(
            "UPDATE analyses SET analyzed_by_user_id = ("
            "  SELECT u.id FROM users u"
            "  WHERE u.client_id = analyses.client_id AND u.email = analyses.analyzed_by"
            "  LIMIT 1) "
            "WHERE analyzed_by_user_id IS NULL"
        ))
        conn.execute(text(
            "UPDATE analyses SET analyzed_by_user_id = ("
            "  SELECT u.id FROM users u"
            "  WHERE u.client_id = analyses.client_id AND u.full_name = analyses.analyzed_by"
            "  ORDER BY CASE WHEN u.role='membre' THEN 0 WHEN u.role='brand_admin' THEN 1 ELSE 2 END, u.id"
            "  LIMIT 1) "
            "WHERE analyzed_by_user_id IS NULL"
        ))

        # 4. Performance indexes for the hot paths (history filters, member/tenant
        #    scoping, dashboard aggregates, conversation threads, rewrite lookups).
        #    CREATE INDEX IF NOT EXISTS is idempotent on both SQLite and Postgres,
        #    so these statements carry forward to the Postgres migration unchanged.
        _indexes = [
            "CREATE INDEX IF NOT EXISTS ix_analyses_client_date  ON analyses (client_id, analyzed_at)",
            "CREATE INDEX IF NOT EXISTS ix_analyses_brand_system ON analyses (brand_system_id)",
            "CREATE INDEX IF NOT EXISTS ix_analyses_analyzed_by  ON analyses (analyzed_by)",
            "CREATE INDEX IF NOT EXISTS ix_analyses_author_user  ON analyses (analyzed_by_user_id)",
            "CREATE INDEX IF NOT EXISTS ix_analyses_parent       ON analyses (parent_analysis_id)",
            "CREATE INDEX IF NOT EXISTS ix_analyses_conversation ON analyses (conversation_id, iteration_index)",
            "CREATE INDEX IF NOT EXISTS ix_brand_systems_client  ON brand_systems (client_id)",
            "CREATE INDEX IF NOT EXISTS ix_users_client          ON users (client_id)",
        ]
        for stmt in _indexes:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass  # index already exists / unsupported syntax — safe to ignore

        conn.commit()


def _add_column(conn, table: str, column: str, col_type: str):
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        conn.commit()
    except Exception:
        pass  # Column already exists — safe to ignore
