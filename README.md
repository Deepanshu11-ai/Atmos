# Atmos

## Turn everyday operational data into climate action.

**Atmos** is the calm, practical workspace for teams that want to understand their carbon footprint without turning carbon accounting into another spreadsheet project.

Upload the bills your business already has. Atmos organizes the evidence, turns it into clear emissions estimates, helps teams manage analysis credits, and produces a report that is ready to share.

**[Explore the live app →](https://atmos-g4pe.onrender.com/#home)**

---

## From source document to a clearer climate picture

### 1. Bring your evidence

Upload utility and operational PDF bills directly, or select a PDF from Google Drive. Bills stay scoped to the right department and are available to the people who need them.

### 2. Analyze what matters

Atmos extracts readable bill evidence and creates a structured estimate of carbon emissions: source category, consumption, estimated CO2e, confidence, and practical reduction ideas.

### 3. Keep teams moving

Set up departments, invite the right people, and give every role a focused workspace:

- **Admins** manage departments, teams, credits, payments, and reports.
- **Data Officers** upload and organize bill evidence.
- **Compliance Managers** review emissions and prepare reports.

### 4. Share progress with confidence

Create a department climate report covering uploaded bills, analyzed emissions, available and used credits, and verified payments. Download it or send it by email.

---

## Built for practical climate operations

| Capability | Why it matters |
| --- | --- |
| **Evidence-led accounting** | Start from real source documents instead of disconnected estimates. |
| **AI-assisted analysis** | Turn readable bill data into structured carbon insights and reduction suggestions. |
| **Department controls** | Keep evidence, credits, and access aligned with the team that owns them. |
| **Prepaid credit system** | Give teams a transparent way to fund and track emissions analysis. |
| **Secure checkout** | Credit purchases are verified server-side with Razorpay before they are applied. |
| **Reporting built in** | Make a decision-ready PDF without exporting data across multiple tools. |
| **Guardrailed help** | In-product guidance helps people use Atmos without accessing records or handling credentials. |

---

## Designed to feel lighter than the work it replaces

Atmos combines a botanical climate-tech interface with a workflow grounded in operational reality. The experience is intentionally focused: fewer dashboards to decipher, clearer next steps, and a shared view of the evidence behind each estimate.

> Carbon reporting is more useful when it starts with the work teams already do.

---

## Trust by design

- Role- and department-scoped access to bills, emissions, and reports
- Passwords protected with Argon2 hashing
- Revocable, server-side session management
- Payment, database, email, and AI credentials remain server-side
- Payment verification before credits are issued
- Google Drive uses short-lived, read-only browser authorization; Atmos does not retain Drive tokens
- Help assistant rejects credentials, sensitive payment data, and prompt-injection attempts

Emissions outputs are decision-support estimates. Teams should review results before using them for formal reporting or compliance submissions.

---

## Product at a glance

- **Frontend:** Vite-powered web application with a polished climate-tech workspace
- **Backend:** FastAPI API and production static-file delivery
- **Data:** PostgreSQL / Neon-ready persistence
- **Payments:** Razorpay credit checkout and server-side verification
- **AI:** Azure AI Foundry-powered PDF bill analysis
- **Deployment:** One Docker container, ready for Render

## Run or contribute

Technical setup, API documentation, integration configuration, testing, and Render deployment instructions are available in **[project/README.md](project/README.md)**.

```bash
cd project
docker compose up --build
```

Then open [http://localhost:8000](http://localhost:8000).

---

## Make climate data useful

Atmos helps teams move from scattered bills to a shared, evidence-led understanding of their operational footprint—so the next climate decision can be simpler, faster, and better informed.

**[Start with Atmos →](https://atmos-g4pe.onrender.com/#register)**
