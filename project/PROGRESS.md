# Project progress

## Completed

- Public account registration creates an owner without a department; the owner creates their first department when ready. All registered users can log in with Argon2-hashed passwords and database-backed bearer sessions.
- Owners can create additional departments and assign newly created Data Officers and Compliance Managers to their owned departments. Existing invited admins can manage users in their own department; existing employees can still log in but cannot add users.
- Department credit packs in INR, admin-only purchase recording and department-to-department transfers, shared balances, spending and scoped transaction history.
- Existing schema upgrades without dropping account records; bootstrap admin credentials are optional.
- Owners may reuse department names used by other owners. Within an owner's workspace names remain case-insensitively unique. Admins can create only Data Officers and Compliance Managers; existing employee and admin accounts retain their roles.
- Postman collection tests public signup, adding departments and a Data Officer, staff login, purchasing, spending, and sharing credits.
- Data Officers have a dedicated Bills workspace where they can upload, list, and download department-scoped PDF bills. Uploads are validated as PDFs, limited to 10 MB, and persisted in the database. Admins can manage bills for any department they own.
- Bill list queries load metadata without loading every PDF blob, while individual downloads use an extended timeout for remote database storage.
- Compliance Managers and admins have a department-scoped Emissions dashboard. Stored bill text can be analyzed through an Azure AI Foundry model, and structured bill-level CO2e estimates, confidence scores, summaries, and reduction suggestions are persisted without re-analyzing completed bills.
- Emissions reporting includes monthly comparisons, source percentages, total and pending bill counts, driving and tree equivalents, practical reduction tips, and plain-language explanations designed for non-technical users.
- Successful emissions analysis retires department carbon credits at one credit per tonne of combined CO2e, rounding the department total up once (for example, 9.50 tonnes uses 10 credits). Analysis, balance adjustment, and the audit transaction commit atomically; older per-bill overcharges are refunded during reconciliation, and open admin dashboards poll for updated balances.
- Compliance Managers no longer see Buy credits navigation or the sidebar credit-pack shortcut. Credit purchases remain available to admins.
- Credit plans load independently of login. The admin Buy credits page loads missing plans and displays a recoverable error with a Try again button instead of remaining stuck on Loading plans.
- Azure Foundry configuration supports `AZURE_AI_PROJECT_ENDPOINT`, `AZURE_AI_API_KEY`, and `AZURE_AI_MODEL`, plus the existing `PROJECT_ENDPOINT`, `AZURE_API_KEY`, and `MODEL_NAME` aliases. The configured deployment and API-key authentication were verified successfully.
- Backend workflow tests cover role authorization, bill storage/download, admin visibility, emissions aggregation, compliance access, combined-total credit deduction, repeat reconciliation without double charging, and refunds for previous per-bill rounding overcharges. Frontend syntax checks, API tests, and production builds pass.

## Current behavior

- Credit pack prices are example values. Purchases record credits without processing real payments.
- Credit balances are shared by department; credits do not expire. All logged-in users may spend from their own department.
- Public signup creates a new owner without a department. Joining a department requires an authorized admin to create the user's account and assign a department.
- Data Officers are restricted to their Bills workspace. Compliance Managers can review emissions analytics and reduction guidance; admins retain visibility across their managed departments.
- Carbon-credit balances use whole credits: the combined department emissions total is divided by 1,000 kg and rounded up once. Reconcile carbon credits applies missing deductions or refunds previous rounding overcharges without re-running AI analysis; admin balances update within approximately 15 seconds while the page is visible.
- Emissions are AI-assisted estimates derived from readable PDF text. Scanned image-only PDFs require OCR, and estimates should be reviewed before formal disclosures.

## Next integrations

- Charge through a payment provider before applying purchased credits.
- Connect credit spending to product features that actually use credits.
- Add OCR for scanned bills and approved region-specific emissions-factor datasets for audit-grade reporting.
