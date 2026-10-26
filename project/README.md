# Atmos — team accounts and prepaid credits

FastAPI application with public sign-up, department-scoped account management, and shared prepaid credits. Anyone can create an owner account without a department. When ready, the owner creates their first department and can add others. Admins can add users only as `data_officer` or `compliance_manager`; they cannot create another admin or a general employee. Only admins can buy credits. Owners can transfer credits between departments they manage. Staff can log in and use their department's credits.

## Start

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn app.main:app --reload --reload-dir app
```

The existing `.env` supplies `NEON_DATABASE_URL`. Database tables are created or upgraded on startup. No bootstrap admin is required: start with `POST /auth/register` or import `postman_collection.json` and run the requests in order. Optionally, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` can bootstrap the first admin for a fresh database.

## Account workflow

1. `POST /auth/register` with `{"name":"Owner","email":"owner@example.com","password":"a-strong-password"}` creates an owner without a department.
2. `POST /auth/login` with email and password returns a bearer token. Existing accounts of any role can still log in.
3. `POST /admin/departments` with `{"name":"Sales"}` creates a department with an empty credit balance. The first department becomes the owner's home department. `GET /admin/departments` lists departments the admin can manage. Two unrelated owners can both have a department named Sales; names must only be unique within the same owner's account (case-insensitive).
4. `POST /admin/users` with `{"name":"Data Officer","email":"officer@example.com","password":"a-strong-password","role":"data_officer","department_id":2}` adds a user to an authorized department. The required `role` must be `data_officer` or `compliance_manager`. Omit `department_id` to use the admin's own department. `GET /admin/users?department_id=2` lists users in an authorized department. Only admins can create users; these staff roles have regular department access.

The department IDs in these examples are illustrative. Owners can assign users to any department they own. Existing invited department admins can manage users in their own department, but newly invited users cannot be made admins. Public sign-up does not create or join a department; an admin creates staff accounts in their chosen department.

## Credit endpoints

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/credits/plans` | Public | View available packs |
| GET | `/credits/balance` | Logged-in user | View own department balance; a managing admin can use `?department_id=2` |
| POST | `/admin/credits/purchases` | Admin | Record a pack purchase: `{"plan":"starter","department_id":2}`; omit department ID for own department |
| POST | `/admin/credits/transfers` | Admin managing both departments | Move credits between teams: `{"from_department_id":1,"to_department_id":2,"credits":25}` |
| POST | `/credits/spend` | Logged-in user | Spend from own department with `{"credits":5}`; insufficient balance returns 409 |
| GET | `/admin/credits/transactions` | Admin | View department ledger; optionally specify an owned `?department_id=2` |

Plans defined in `app/credits.py` are **starter** (100 credits, ₹999), **growth** (500 credits, ₹3,999) and **scale** (2,000 credits, ₹12,999). Prices are examples, denominated in INR (the API stores the smallest currency unit in `price_cents`). Purchases record credits but do **not** charge a real payment method. Credits are shared by users in the chosen department and do not expire. Transfers deduct and add credits atomically, with a ledger entry in each department.

`GET /users/me` shows your role and department. `POST /auth/logout` revokes your current token. Only public signup creates a new owner with the `admin` role; existing department admins remain active.

## Emissions analysis

Compliance managers and admins can open the Emissions dashboard to analyze stored PDF bills, view monthly and source graphs, and review reduction suggestions. Configure the Foundry deployment in the backend `.env` without exposing credentials to the frontend:

```dotenv
AZURE_AI_PROJECT_ENDPOINT=https://your-resource.services.ai.azure.com/api/projects/your-project
AZURE_AI_API_KEY=your-api-key
AZURE_AI_MODEL=your-deployment-name
```

The aliases `PROJECT_ENDPOINT`, `AZURE_API_KEY`, and `MODEL_NAME` are also supported.

The application derives the resource's OpenAI-compatible endpoint from the project URL. PDF text is extracted by the backend, structured bill-level estimates are persisted, and previously analyzed bills are not sent again. Estimates are decision-support information and should be reviewed before formal emissions reporting. Scanned image-only PDFs require OCR before upload.

## Postman

Import `postman_collection.json` and run its requests in order. It generates unique account emails and department names automatically, so **no admin credentials need to be set**. Each run creates a new owner, two departments, one Data Officer, a 100-credit purchase and a five-credit spend. Set `baseUrl` if the app does not run at `http://127.0.0.1:8000`.
