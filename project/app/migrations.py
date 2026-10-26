"""Non-destructive upgrade from the original users/memberships schema."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.database import Base


def initialize_database(engine: Engine) -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        old_users = inspector.has_table("users") and not any(
            column["name"] == "department_id" for column in inspector.get_columns("users")
        )
        old_departments = inspector.has_table("departments") and not any(
            column["name"] == "owner_id" for column in inspector.get_columns("departments")
        )
        if old_users:
            conn.execute(text("ALTER TABLE users ADD COLUMN department_id INTEGER"))
        if old_departments:
            conn.execute(text("ALTER TABLE departments ADD COLUMN owner_id INTEGER"))

        Base.metadata.create_all(bind=conn)

        # Analyses created before carbon-credit retirement was introduced have
        # no applied-credit marker and are reconciled on the next analysis run.
        if inspector.has_table("emission_analyses") and not any(
            column["name"] == "credits_used" for column in inspector.get_columns("emission_analyses")
        ):
            conn.execute(text("ALTER TABLE emission_analyses ADD COLUMN credits_used INTEGER"))

        # Old versions used a global UNIQUE(name) constraint. Allow different
        # owners to call their department "Sales" while preventing duplicates
        # (including case-only differences) within one owner's workspace.
        for constraint in inspect(conn).get_unique_constraints("departments"):
            if constraint["column_names"] == ["name"]:
                if engine.dialect.name == "postgresql":
                    name = engine.dialect.identifier_preparer.quote(constraint["name"])
                    conn.execute(text(f"ALTER TABLE departments DROP CONSTRAINT {name}"))
                # SQLite cannot drop a table-level UNIQUE constraint in place.
                # Fresh SQLite databases are created with the new schema.
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_departments_owner_name "
            "ON departments (owner_id, lower(name))"
        ))

        if engine.dialect.name == "postgresql" and inspector.has_table("users"):
            for constraint in inspect(conn).get_check_constraints("users"):
                if constraint["name"] == "ck_users_role" and "data_officer" not in constraint["sqltext"]:
                    conn.execute(text("ALTER TABLE users DROP CONSTRAINT ck_users_role"))
                    conn.execute(text(
                        "ALTER TABLE users ADD CONSTRAINT ck_users_role "
                        "CHECK (role IN ('admin', 'employee', 'data_officer', 'compliance_manager'))"
                    ))
                    break

        # An owner can sign up before creating their first department.
        if inspector.has_table("users") and any(
            column["name"] == "department_id" and not column["nullable"]
            for column in inspector.get_columns("users")
        ):
            conn.execute(text("ALTER TABLE users ALTER COLUMN department_id DROP NOT NULL"))

        if old_users:
            department_id = conn.execute(
                text("INSERT INTO departments (name) VALUES (:name) RETURNING id"),
                {"name": "Main Department"},
            ).scalar_one()
            conn.execute(
                text("INSERT INTO credit_accounts (department_id, balance) VALUES (:id, 0)"),
                {"id": department_id},
            )
            conn.execute(text("UPDATE users SET department_id = :id WHERE department_id IS NULL"), {"id": department_id})
            conn.execute(text("ALTER TABLE users ALTER COLUMN department_id SET NOT NULL"))
            conn.execute(text(
                "ALTER TABLE users ADD CONSTRAINT fk_users_department_id "
                "FOREIGN KEY (department_id) REFERENCES departments (id)"
            ))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_department_id ON users (department_id)"))

        if old_departments:
            conn.execute(text(
                "UPDATE departments SET owner_id = ("
                "SELECT user_id FROM users WHERE department_id = departments.id AND role = 'admin' "
                "ORDER BY user_id LIMIT 1)"
            ))
            conn.execute(text(
                "ALTER TABLE departments ADD CONSTRAINT fk_departments_owner_id "
                "FOREIGN KEY (owner_id) REFERENCES users (user_id)"
            ))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_departments_owner_id ON departments (owner_id)"))

        # Empty legacy memberships contain no credits to migrate. Preserve nonempty
        # legacy records rather than silently assigning an invented credit value.
        if inspector.has_table("memberships") and conn.execute(text("SELECT count(*) FROM memberships")).scalar_one() == 0:
            conn.execute(text("DROP TABLE memberships"))
