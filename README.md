# Atmos

> 🌿 **Climate intelligence, grounded in operational reality.**

## Make your operational data the starting point for climate action.

Atmos is the climate-accounting workspace for teams that need a clearer path from everyday operational evidence to informed climate decisions. Instead of beginning with a blank spreadsheet, teams begin with the documents they already use: utility bills, fuel records, invoices, and other operational PDFs.

Upload the evidence. Organize it by department. Turn readable bill data into structured emissions estimates. Give the right people the right workspace. Then create a report that makes progress easier to understand and share.

<p align="center">
  <a href="https://atmos-g4pe.onrender.com/#home">🌍 Explore Atmos</a>
  &nbsp;·&nbsp;
  <a href="https://atmos-g4pe.onrender.com/#register">✨ Create your workspace</a>
</p>

```text
                    .-~~~~~~~~~~~~-.
                .-~'   🌿  ATMOS    '~-.             ┌─────────────────┐
              .'  evidence → insight  '.            │  clearer climate │
             /  📄 ── ✨ ── 🌍 ── 📊    \───────────▶│  decisions       │
             \       \       |       /             └─────────────────┘
              '.      🍃     |     .'
                '-.__________|__.-'
                           🌱
```

<p align="center">⎯⎯⎯&nbsp;&nbsp; 🌱 &nbsp;&nbsp;⎯⎯⎯</p>

## 🧭 Climate reporting should not begin with a scavenger hunt

For many organizations, the information needed to understand operational emissions already exists—but it is scattered across inboxes, folders, departments, and spreadsheets. That makes carbon work slower than it needs to be, difficult to coordinate, and hard to explain with confidence.

Atmos creates a practical operating layer for that work. It connects source evidence, emissions analysis, credit usage, team responsibilities, and reporting in one focused workspace.

### ✦ With Atmos, your team can:

- 📄 **Start with real evidence** by uploading operational PDF bills or selecting them from Google Drive.
- ✨ **Turn documents into insight** with structured estimates for source category, consumption, CO2e, confidence, and reduction opportunities.
- 🧩 **Keep work properly owned** with department-level access and focused role permissions.
- 💳 **Fund analysis transparently** through a prepaid credit model and verified purchases.
- 📊 **Show the work behind the numbers** in a department climate report that brings evidence, emissions, credits, and verified payments together.

<p align="center">📄 &nbsp;→&nbsp; ✨ &nbsp;→&nbsp; 🌍 &nbsp;→&nbsp; 📈</p>

## 🌍 A better workflow for operational climate intelligence

### 01 — 📥 Bring the evidence together

Atmos gives teams a dedicated place for the PDFs that already describe their operations. A utility bill, fuel invoice, travel document, waste record, or other readable source PDF can be uploaded directly to the right department.

For teams already working in Google Drive, **Add from Google Drive** lets an authorized user choose a PDF through Google Picker and move it into the same bill workflow. Atmos uses short-lived, read-only access for that selection; it does not retain ongoing access to a user’s Drive.

### 02 — ✨ Turn source documents into a clearer carbon picture

Admins and Compliance Managers can analyze uploaded bills through Azure AI Foundry. Atmos extracts readable document text and produces a structured estimate that includes:

- the relevant emissions category
- a billing period and consumption value when available
- estimated kilograms of CO2e
- a confidence signal
- a concise explanation of the estimate
- three practical, bill-specific reduction suggestions

The result is not a black-box score. It is a practical, evidence-led starting point that helps teams understand what they have, what it means, and what they can investigate next.

### 03 — 🧑‍🤝‍🧑 Put responsibility where the work happens

Climate work crosses functions, but access should remain clear. Atmos uses department-scoped workspaces and focused roles so teams can collaborate without exposing every record to every user.

| Role | What they can do |
| --- | --- |
| **Admin** | Create and manage owned departments, add team members, upload and review bills, purchase and transfer credits, and create reports. |
| **Data Officer** | Upload and view source PDF bills for their own department. |
| **Compliance Manager** | Review department emissions analysis and generate department reports. |

### 04 — 💳 Keep analysis funding visible

Atmos uses prepaid credits to make analysis usage easy to understand. Admins can choose a credit pack, complete secure Razorpay checkout, and receive credits only after server-side payment verification. Credits can be spent on analysis and, for organizations with multiple departments, transferred between teams that the admin manages.

This creates a clear trail from purchase to allocation to usage—without mixing financial workflow into the analysis experience.

### 05 — 📈 Make progress easier to communicate

When it is time to share the story, Atmos creates a department climate report that pulls together:

- current credit availability and credit usage
- uploaded and analyzed bill counts
- estimated emissions from analyzed source evidence
- verified payment activity
- reduction suggestions associated with analyzed bills

Download the report as a PDF or email it to the signed-in user. The aim is simple: fewer manual handoffs, more context, and a clearer explanation of the information behind the numbers.

<p align="center">⎯⎯⎯&nbsp;&nbsp; 🍃 &nbsp;&nbsp;⎯⎯⎯</p>

## 🚀 Designed for teams that need progress, not more process

| What your team needs | How Atmos helps |
| --- | --- |
| A practical first step | Begin with bills and operational evidence you already collect. |
| A single source of truth | Keep documents, estimates, credits, and reporting connected in one workspace. |
| Better collaboration | Give Admins, Data Officers, and Compliance Managers role-specific access. |
| More credible conversations | Keep each estimate connected to the bill evidence that informed it. |
| Less manual reporting | Generate a department-ready PDF without stitching exports together. |
| Stronger payment controls | Verify every Razorpay payment on the server before credits are issued. |
| Helpful guidance without risk | Use built-in help that can guide workflow but cannot read records, take payments, or handle credentials. |

<p align="center">⎯⎯⎯&nbsp;&nbsp; 🛡️ &nbsp;&nbsp;⎯⎯⎯</p>

## 🛡️ Trust is part of the product

Atmos is built for operational teams handling documents, payment activity, and organization-level emissions data. Its workflow includes practical safeguards at every step.

### 🔐 Access stays scoped

- Bills, emissions analysis, credits, and reports are limited by role and department.
- Admins manage only the departments they own or are authorized to manage.
- Data Officers and Compliance Managers work only within the access boundaries relevant to their role.

### 🔒 Sensitive credentials stay on the server

- Passwords are protected with Argon2 hashing.
- User sessions are stored as hashes server-side and can be revoked on logout.
- Database URLs, Azure AI keys, Razorpay secrets, SMTP credentials, and other sensitive configuration remain server-side.
- Razorpay signatures and payment status are verified before a credit purchase is applied.

### 💬 Help remains help

Atmos Help is intentionally constrained. It can explain how to use bills, emissions, credits, reports, departments, and team access. It cannot access private department records, perform product actions, process payment information, reveal credentials, or provide formal legal, financial, or compliance advice.

> **Important:** Emissions results are decision-support estimates. Teams should review the evidence, assumptions, and results before using them for formal reporting or compliance submissions.

<p align="center">⎯⎯⎯&nbsp;&nbsp; ⚙️ &nbsp;&nbsp;⎯⎯⎯</p>

## ⚙️ Built to fit into your stack

Atmos combines a polished climate-tech experience with a production-ready full-stack architecture.

| Layer | Technology |
| --- | --- |
| **Workspace experience** | Vite web application with React, Motion, and Three.js dependencies |
| **API and application server** | FastAPI and Uvicorn |
| **Persistence** | PostgreSQL via SQLAlchemy, compatible with Neon |
| **Document handling** | PDF ingestion and text extraction with PyPDF |
| **AI analysis** | Azure AI Foundry project endpoint and model deployment |
| **Payments** | Razorpay checkout with server-side verification |
| **Email** | Configurable SMTP for welcome messages, receipts, and reports |
| **Deployment** | One Docker image serving the compiled frontend and FastAPI API, with Render configuration included |

The production deployment serves the frontend and API from the same domain. That keeps the browser experience simple: frontend requests use `/api/...`, while the application handles routing and static delivery from one container.

<p align="center">⎯⎯⎯&nbsp;&nbsp; 🌤️ &nbsp;&nbsp;⎯⎯⎯</p>

## 🌤️ Start exploring Atmos

The fastest way to experience the product is to create an owner account, create your first department, and add a source PDF bill.

1. ✨ **Create your workspace** from the registration page.
2. 🧩 **Create a department** for the team or business unit that owns the operational evidence.
3. 🧑‍🤝‍🧑 **Invite the right people** as Data Officers or Compliance Managers.
4. 📄 **Upload a readable PDF bill** or select one from Google Drive.
5. 💳 **Purchase credits** if you are ready to analyze bills.
6. 📊 **Review emissions and generate a report** when you need to communicate progress.

**[Open the live Atmos workspace →](https://atmos-g4pe.onrender.com/#home)**

<p align="center">⎯⎯⎯&nbsp;&nbsp; 🧪 &nbsp;&nbsp;⎯⎯⎯</p>

## 🧪 Run Atmos locally

Atmos includes a production-style Docker Compose setup for local use. Create `project/.env` with your PostgreSQL connection string, then run:

```bash
cd project
docker compose up --build
```

Open [http://localhost:8000](http://localhost:8000).

For local frontend development, environment variables, API endpoints, testing, Google Drive setup, Azure AI Foundry configuration, payment setup, and Render deployment, read the **[technical project guide](project/README.md)**.

<p align="center">🌱 &nbsp;Evidence-led. Team-ready. Action-oriented.&nbsp; 🌱</p>

## ✦ Make the next climate decision a clearer one

Atmos helps organizations move from scattered operational documents to a shared, evidence-led understanding of their footprint. It gives teams a calmer place to organize the work, a more practical way to analyze it, and a better story to share when action matters.

**[Get started with Atmos →](https://atmos-g4pe.onrender.com/#register)**
