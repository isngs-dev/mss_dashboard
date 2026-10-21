"""Bootstrap an empty Postgres database for a Render deploy (run before uvicorn starts).

docker-compose applies services/ingestion/dashboard_schema.sql through Postgres'
``docker-entrypoint-initdb.d``; Render's managed Postgres has no equivalent, and the numbered
migrations only layer on top of that base schema. So on every start this script:

1. Applies the base schema (every statement is ``IF NOT EXISTS`` / ``ON CONFLICT`` — idempotent).
2. If ``SEED_DEMO_DATA=true`` and the database has no tenants yet, seeds the demo tenants and
   demo login accounts (see CLAUDE.md / scripts/seed_*.py). It never re-seeds a populated DB.
3. If ``DEMO_KEEP_PROJECTS_ACTIVE=true``, moves the end_date of already-ended projects to
   today + 90 days so they appear under the dashboard's "All Active" filter (demo only).

The API's own startup then applies the numbered migrations (services/api/main.py lifespan).

Usage (render.yaml startCommand):
    python scripts/render_bootstrap.py && uvicorn services.api.main:app ...
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA_SQL = ROOT / "services" / "ingestion" / "dashboard_schema.sql"


def _database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("render_bootstrap: DATABASE_URL is not set")
    return url


def apply_base_schema(database_url: str) -> None:
    import psycopg

    with psycopg.connect(database_url) as conn:
        conn.execute(SCHEMA_SQL.read_text(encoding="utf-8"))
    print("render_bootstrap: base schema applied", flush=True)


def tenant_count(database_url: str) -> int:
    import psycopg

    with psycopg.connect(database_url) as conn:
        row = conn.execute("SELECT count(*) FROM dashboard.tenants").fetchone()
    return int(row[0]) if row else 0


def seed_demo_data(database_url: str) -> None:
    # The seed scripts import the `services` package, which is not installed — put the repo
    # root on PYTHONPATH exactly like running them from a checkout.
    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    for script, args in (
        ("seed_multi_tenant_test_data.py", ["--tenants", "3"]),
        ("seed_demo_users.py", []),
    ):
        print(f"render_bootstrap: running scripts/{script}", flush=True)
        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / script), "--db-url", database_url, *args],
            check=True,
            cwd=ROOT,
            env=env,
        )


def keep_demo_projects_active(database_url: str, days_ahead: int = 90) -> None:
    """Push already-ended projects' end_date to today + N days (demo convenience).

    The seeded campaigns ended in April 2026, so the dashboard's "All Active" / "Current Month"
    filters show nothing. This only moves end_date; start_date and visits are untouched.
    """
    import psycopg

    with psycopg.connect(database_url) as conn:
        cur = conn.execute(
            "UPDATE dashboard.projects SET end_date = CURRENT_DATE + %s "
            "WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE",
            (days_ahead,),
        )
    print(f"render_bootstrap: extended end_date on {cur.rowcount} project(s)", flush=True)


def _flag(name: str) -> bool:
    return os.environ.get(name, "").lower() in ("1", "true")


def main() -> None:
    database_url = _database_url()
    apply_base_schema(database_url)

    if _flag("SEED_DEMO_DATA"):
        if tenant_count(database_url) > 0:
            print("render_bootstrap: tenants already present, skipping demo seed", flush=True)
        else:
            seed_demo_data(database_url)

    if _flag("DEMO_KEEP_PROJECTS_ACTIVE"):
        keep_demo_projects_active(database_url)


if __name__ == "__main__":
    main()
