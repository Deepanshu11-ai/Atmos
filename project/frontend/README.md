# Atmos

A user-facing workspace for teams sharing prepaid credits. It includes a public landing page, sign-up and login, a personalized dashboard, a credit-pack purchase flow, activity history, team management, and departments. All account and credit data comes from the existing FastAPI backend.

## Run locally

Start the backend from `atmos/`:

```bash
python3 -m uvicorn app.main:app --reload --reload-dir app
```

Start the frontend from `atmos/frontend/`:

```bash
npm install
npm run dev
```

Open the URL Vite prints, normally **http://127.0.0.1:5173**. The homepage is public; **Get started** creates your owner account and signs you in. You can then create your first department whenever you're ready, assign teammates to the department you choose, and buy credits. Admins can choose a managed department in the header, add people and departments, buy packs, and share credits between their departments. Team members see their department balance. Two owners may each use the same department name; a name only needs to be unique within its owner's workspace.

An admin can create users only as `data_officer` (Data Officer) or `compliance_manager` (Compliance Manager). The add-user form has no general team member or admin role option, and the API rejects both roles for new users. Existing users keep their roles and can still log in. Only admins may purchase or share credits. Owners may share between departments they own from the Departments page; existing invited department admins may only manage their own department. Selecting a department before creating a user determines which department's members are shown, while the **Assign to department** field determines where the new user is placed.

**Purchase behavior:** Pack prices are shown in rupees (INR) from `GET /credits/plans`, but the backend's purchase endpoint records demo credits immediately without collecting payment. The checkout review labels this clearly. There is no payment processor or card form.

Vite proxies `/api` to `http://127.0.0.1:8000`. Copy `.env.example` to `.env` and set `BACKEND_URL` to point to a different backend. Tokens are held in this browser tab's `sessionStorage`, and logging out revokes the token on the backend. The employee transaction history and credit-spending controls are not exposed because the current backend only offers admin ledger access and no user-facing action tied to spending.

## Checks

```bash
npm run check
npm test
npm run build
```

For production hosting behind a different static server, forward `/api` requests to FastAPI, stripping the `/api` prefix. Vite preview already uses the same proxy as the dev server.
