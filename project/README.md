# Atmos

Atmos is a climate-accounting workspace for teams. It lets organizations upload operational bills, estimate carbon emissions from the bill evidence, manage prepaid analysis credits, and generate department reports.

The application consists of a FastAPI backend, a Vite frontend, and a PostgreSQL database. Production Docker builds serve both the API and the compiled frontend from one container.

## What it does

- **Account and team management** — public owner registration, login sessions, departments, and role-based team access.
- **Bill management** — upload and retrieve PDF bills (up to 10 MB), optionally import a PDF through Google Drive Picker.
- **Emissions analysis** — admins and Compliance Managers can analyze uploaded bills with Azure AI Foundry and view estimated CO2e, category, confidence, and reduction suggestions.
- **Prepaid credits** — purchase credit packs through Razorpay, verify payments server-side, spend credits on analysis, and transfer credits between departments.
- **Reports** — download or email a department PDF summary of bills, emissions, credits, and verified payments.
- **Safe in-app help** — a constrained, role-aware helper for product guidance; it cannot access data, perform actions, or process secrets.

## Roles

| Role | Access |
| --- | --- |
| `admin` | Creates and manages owned departments, members, credit purchases/transfers, bills, and reports. Public sign-up creates an admin. |
| `data_officer` | Uploads and views bills for their department. |
| `compliance_manager` | Views emissions analytics and generates reports for their department. |

## Project structure

```text
project/
├── app/                 # FastAPI routes, database models, integrations
├── frontend/            # Vite single-page application
├── tests/               # Backend workflow tests
├── Dockerfile           # Production frontend build + FastAPI runtime image
├── compose.yaml         # Local Docker Compose configuration
└── render.yaml          # Render deployment blueprint
```

## Prerequisites

- Python 3.12+
- Node.js 22+ and npm (for frontend development)
- PostgreSQL database, such as Neon
- Docker Desktop (optional, for the production-like local setup)

## Configure environment variables

Create `project/.env`. It is intentionally ignored by Git. At minimum, configure a PostgreSQL connection string:

```dotenv
NEON_DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

`DATABASE_URL` is also accepted as an alternative name. Atmos initializes/upgrades its tables when the API starts.

### Optional integrations

| Feature | Variables |
| --- | --- |
| Razorpay credit checkout | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` |
| Azure AI Foundry bill analysis | `AZURE_AI_PROJECT_ENDPOINT`, `AZURE_AI_API_KEY`, `AZURE_AI_MODEL` |
| Google Drive Picker | `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_API_KEY`, optionally `GOOGLE_DRIVE_APP_ID` |
| Welcome emails, receipts, emailed reports | `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_USE_SSL` |

Never commit `.env`, API keys, database passwords, payment secrets, or SMTP credentials.

## Run locally

### Backend

From `project/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --reload-dir app
```

The API runs at `http://127.0.0.1:8000`. Health check:

```bash
curl http://127.0.0.1:8000/health
```

### Frontend development server

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Vite forwards browser requests from `/api/*` to `http://127.0.0.1:8000/*`.

### Run the full production-style stack with Docker

From `project/`:

```bash
docker compose up --build
```

Open `http://localhost:8000`. The Docker image builds the frontend and FastAPI serves it along with the API on the same domain. Stop it with:

```bash
docker compose down
```

## Typical user workflow

1. Register an owner account from the app or `POST /auth/register`.
2. Sign in and create a department.
3. Invite a **Data Officer** to upload source PDF bills and/or a **Compliance Manager** to review emissions.
4. Purchase a credit pack (admin only) and complete Razorpay checkout.
5. Upload bills, analyze pending bills, and review estimated emissions and suggestions.
6. Download or email the department report.

## API overview

The browser uses `/api/...` in production. FastAPI accepts the equivalent routes without `/api` as well.

| Area | Key endpoints |
| --- | --- |
| Health | `GET /health` |
| Authentication | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /users/me` |
| Departments and team | `POST/GET /admin/departments`, `POST/GET /admin/users` |
| Credits | `GET /credits/plans`, `GET /credits/balance`, `POST /admin/credits/purchases`, `POST /admin/credits/purchases/verify`, `POST /credits/spend`, `POST /admin/credits/transfers` |
| Bills | `GET/POST /bills`, `GET /bills/{bill_id}/file`, `GET /bills/google-drive/config` |
| Emissions | `GET /emissions`, `POST /emissions/analyze` |
| Reports | `GET /reports/download`, `POST /reports/email` |
| Help | `POST /support/chat` |

Authenticated endpoints require the bearer token returned by `/auth/login`:

```http
Authorization: Bearer <access_token>
```

## Payments and credits

The current catalog is configured in `app/credits.py`:

- `starter`: 100 credits for ₹1
- `growth`: 500 credits for ₹10
- `scale`: 2,000 credits for ₹20

Razorpay orders are created at the server-defined price. The backend verifies the checkout signature and payment before adding credits, preventing client-side price manipulation and duplicate crediting.

## Google Drive setup

To enable **Add from Google Drive**:

1. Enable **Google Drive API** and **Google Picker API** in Google Cloud.
2. Create a web OAuth client and browser API key.
3. Add local and production frontend origins to the OAuth client's **Authorized JavaScript origins**. Do not include trailing slashes.
4. Set `GOOGLE_DRIVE_CLIENT_ID` and `GOOGLE_DRIVE_API_KEY` in `.env` or your host's environment variables.

Atmos requests a short-lived, read-only token in the browser for the selected file. It does not store a user's Google token.

## Azure AI Foundry setup

Set these server-side values to enable bill analysis:

```dotenv
AZURE_AI_PROJECT_ENDPOINT=https://YOUR-RESOURCE.services.ai.azure.com/api/projects/YOUR-PROJECT
AZURE_AI_API_KEY=your-api-key
AZURE_AI_MODEL=your-model-deployment
```

Atmos extracts readable PDF text and sends it to the configured model for a structured estimate. Scanned/image-only PDFs require OCR before upload. Results are decision-support estimates and should be reviewed before formal reporting.

## Test and verify

```bash
# Backend workflow tests
pytest

# Frontend syntax check and API tests
cd frontend
npm run check
npm test

# Production health endpoint after Docker starts
curl http://localhost:8000/health
```

## Deploy to Render

`render.yaml` defines a Docker web service. If this repository contains `project/` as a subdirectory, set Render's **Root Directory** to `project`.

1. Create a Render Web Service from the repository using Docker.
2. Ensure the Dockerfile path is `./Dockerfile` relative to the root directory.
3. Add `NEON_DATABASE_URL` as a secret environment variable.
4. Add only the optional integration variables for enabled features.
5. Deploy and verify `GET /health` returns `{"status":"ok"}`.

The container honors Render's `PORT` environment variable. The Docker image does not copy your local `.env` file.

For Google Drive, add the exact Render URL—for example `https://your-service.onrender.com`—to the authorized JavaScript origins in Google Cloud.

## Security notes

- Passwords are stored as Argon2 hashes.
- Sessions are bearer tokens stored as hashes server-side and can be revoked on logout.
- Credit verification, payment secrets, SMTP credentials, database URLs, and Azure API keys stay on the server.
- Bill access, team management, analysis, and reports are role- and department-scoped.
- The in-app help endpoint rejects sensitive credentials, prompt-injection patterns, oversized messages, and excessive requests.
