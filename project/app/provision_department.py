"""Provision a separate department and its first admin: python -m app.provision_department."""

import argparse
from getpass import getpass

from pydantic import EmailStr, TypeAdapter
from sqlalchemy import func, select

from app.auth import hash_password
from app.database import CreditAccount, Department, User, get_session_factory
from app.migrations import initialize_database


def main() -> None:
    parser = argparse.ArgumentParser(description="Create a new department and its first admin")
    parser.add_argument("--name", required=True, help="New department name")
    parser.add_argument("--admin-email", required=True, help="New admin email")
    parser.add_argument("--admin-name", required=True, help="New admin name")
    args = parser.parse_args()
    name = args.name.strip()
    email = str(TypeAdapter(EmailStr).validate_python(args.admin_email)).lower()
    if not name or not args.admin_name.strip():
        parser.error("Department and admin names cannot be blank")
    password = getpass("New admin password (at least 8 characters): ")
    if len(password) < 8:
        parser.error("Admin password must be at least 8 characters")

    factory = get_session_factory()
    initialize_database(factory.kw["bind"])
    with factory() as db:
        if db.scalar(select(Department.id).where(func.lower(Department.name) == name.lower())):
            parser.error("Department name already exists")
        if db.scalar(select(User.user_id).where(func.lower(User.email) == email)):
            parser.error("Email already registered")
        department = Department(name=name)
        db.add(department)
        db.flush()
        db.add(CreditAccount(department_id=department.id, balance=0))
        user = User(department_id=department.id, name=args.admin_name.strip(), email=email,
                    role="admin", password_hash=hash_password(password))
        db.add(user)
        db.flush()
        department.owner_id = user.user_id
        db.commit()
        print(f"Created department {name!r} (ID {department.id}) with admin {email}")


if __name__ == "__main__":
    main()
