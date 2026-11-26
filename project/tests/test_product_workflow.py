"""Backend product flows using a temporary in-memory database."""

import hashlib
import hmac
import unittest
from unittest.mock import patch
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import CreditAccount, EmissionAnalysis, get_db
from app.main import app
from app.migrations import initialize_database


class ProductWorkflowTest(unittest.TestCase):
    def setUp(self):
        self.razorpay_secret = "test_secret"
        self.razorpay_orders = {}
        self.environment = patch.dict("os.environ", {
            "RAZORPAY_KEY_ID": "rzp_test_key",
            "RAZORPAY_KEY_SECRET": self.razorpay_secret,
        })
        self.environment.start()
        self.create_order_mock = patch("app.credits.create_razorpay_order", side_effect=self.create_order).start()
        self.fetch_payment_mock = patch("app.credits.fetch_razorpay_payment", side_effect=self.fetch_payment).start()
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
        initialize_database(self.engine)

        def test_db():
            with Session(self.engine) as db:
                yield db

        app.dependency_overrides[get_db] = test_db
        # TestClient without a context manager does not start the production
        # lifespan, which would connect to the configured PostgreSQL database.
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()
        patch.stopall()

    def create_order(self, payload):
        order_id = f"order_test_{len(self.razorpay_orders) + 1}"
        self.razorpay_orders[order_id] = payload
        return {"id": order_id}

    def fetch_payment(self, payment_id):
        order_id = payment_id.removeprefix("pay_")
        order = self.razorpay_orders[order_id]
        return {
            "id": payment_id, "order_id": order_id, "amount": order["amount"],
            "currency": order["currency"], "status": "captured",
        }

    def purchase(self, headers, plan, department_id):
        order = self.client.post("/admin/credits/purchases", headers=headers, json={
            "plan": plan, "department_id": department_id,
        })
        self.assertEqual(order.status_code, 201, order.text)
        order_id = order.json()["order_id"]
        payment_id = f"pay_{order_id}"
        signature = hmac.new(
            self.razorpay_secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256
        ).hexdigest()
        verification = {
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        }
        invalid = self.client.post(
            "/admin/credits/purchases/verify", headers=headers,
            json={**verification, "razorpay_signature": "invalid"},
        )
        self.assertEqual(invalid.status_code, 400, invalid.text)
        response = self.client.post("/admin/credits/purchases/verify", headers=headers, json=verification)
        retry = self.client.post("/admin/credits/purchases/verify", headers=headers, json=verification)
        self.assertEqual(retry.status_code, 201, retry.text)
        self.assertEqual(retry.json()["id"], response.json()["id"])
        return response

    def owner(self, email):
        response = self.client.post("/auth/register", json={
            "name": "Owner", "email": email, "password": "a-strong-password",
        })
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIsNone(response.json()["department_id"])
        login = self.client.post("/auth/login", json={"email": email, "password": "a-strong-password"})
        self.assertEqual(login.status_code, 200, login.text)
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    def department(self, headers, name):
        response = self.client.post("/admin/departments", headers=headers, json={"name": name})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def test_signup_department_names_roles_and_credit_sharing(self):
        alice = self.owner("alice@example.com")
        bob = self.owner("bob@example.com")
        self.assertEqual(self.client.get("/admin/departments", headers=alice).json(), [])
        self.assertEqual(self.client.get("/credits/balance", headers=alice).status_code, 400)

        alice_sales = self.department(alice, "Sales")
        bob_sales = self.department(bob, "Sales")
        self.assertNotEqual(alice_sales, bob_sales)
        duplicate = self.client.post("/admin/departments", headers=alice, json={"name": "sales"})
        self.assertEqual(duplicate.status_code, 409)
        alice_design = self.department(alice, "Design")
        self.assertEqual(self.client.get("/users/me", headers=alice).json()["department_id"], alice_sales)

        # A workspace admin may create only the two designated staff roles.
        for invalid_role in ("admin", "employee"):
            denied = self.client.post("/admin/users", headers=alice, json={
                "name": "Denied", "email": f"{invalid_role}@example.com",
                "password": "a-strong-password", "role": invalid_role,
                "department_id": alice_design,
            })
            self.assertEqual(denied.status_code, 422, denied.text)
        missing_role = self.client.post("/admin/users", headers=alice, json={
            "name": "Denied", "email": "missing@example.com",
            "password": "a-strong-password", "department_id": alice_design,
        })
        self.assertEqual(missing_role.status_code, 422, missing_role.text)

        for role in ("data_officer", "compliance_manager"):
            created = self.client.post("/admin/users", headers=alice, json={
                "name": role, "email": f"{role}@example.com", "password": "a-strong-password",
                "role": role, "department_id": alice_design,
            })
            self.assertEqual(created.status_code, 201, created.text)
            self.assertEqual(created.json()["department_id"], alice_design)
            login = self.client.post("/auth/login", json={
                "email": f"{role}@example.com", "password": "a-strong-password",
            })
            headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
            self.assertEqual(self.client.get("/credits/balance", headers=headers).status_code, 200)
            self.assertEqual(self.client.post("/admin/credits/purchases", headers=headers, json={"plan": "starter"}).status_code, 403)
            self.assertEqual(self.client.post("/admin/credits/transfers", headers=headers, json={
                "from_department_id": alice_sales, "to_department_id": alice_design, "credits": 1,
            }).status_code, 403)

        plans = self.client.get("/credits/plans").json()
        self.assertEqual(plans["starter"]["currency"], "INR")
        purchase = self.purchase(alice, "starter", alice_sales)
        self.assertEqual(purchase.status_code, 201, purchase.text)
        self.assertEqual(purchase.json()["price_cents"], 100)
        self.assertEqual(purchase.json()["currency"], "INR")
        transfer = self.client.post("/admin/credits/transfers", headers=alice, json={
            "from_department_id": alice_sales, "to_department_id": alice_design, "credits": 40,
        })
        self.assertEqual(transfer.status_code, 201, transfer.text)
        self.assertEqual([tx["kind"] for tx in transfer.json()], ["transfer_out", "transfer_in"])
        self.assertEqual([tx["balance_after"] for tx in transfer.json()], [60, 40])

        for department_id, expected in ((alice_sales, 60), (alice_design, 40)):
            balance = self.client.get(f"/credits/balance?department_id={department_id}", headers=alice)
            self.assertEqual(balance.json()["balance"], expected)
        self.assertEqual(self.client.get(f"/credits/balance?department_id={bob_sales}", headers=alice).status_code, 403)
        self.assertEqual(self.client.post("/admin/credits/transfers", headers=alice, json={
            "from_department_id": alice_sales, "to_department_id": bob_sales, "credits": 1,
        }).status_code, 403)
        self.assertEqual(self.client.post("/admin/credits/transfers", headers=alice, json={
            "from_department_id": alice_sales, "to_department_id": alice_design, "credits": 1000,
        }).status_code, 409)
        self.assertEqual(self.client.get(f"/credits/balance?department_id={alice_sales}", headers=alice).json()["balance"], 60)

    def test_data_officer_bill_storage_and_admin_visibility(self):
        admin = self.owner("bill-owner@example.com")
        department_id = self.department(admin, "Operations")
        staff_headers = {}
        for role in ("data_officer", "compliance_manager"):
            email = f"bill-{role}@example.com"
            created = self.client.post("/admin/users", headers=admin, json={
                "name": role, "email": email, "password": "a-strong-password",
                "role": role, "department_id": department_id,
            })
            self.assertEqual(created.status_code, 201, created.text)
            login = self.client.post("/auth/login", json={"email": email, "password": "a-strong-password"})
            staff_headers[role] = {"Authorization": f"Bearer {login.json()['access_token']}"}

        uploaded = self.client.post(
            "/bills", headers=staff_headers["data_officer"],
            files={"file": ("electricity.pdf", b"%PDF-1.4\nvalid-test-pdf", "application/pdf")},
        )
        self.assertEqual(uploaded.status_code, 201, uploaded.text)
        bill_id = uploaded.json()["id"]
        self.assertEqual(uploaded.json()["department_id"], department_id)
        self.assertEqual(self.client.get("/bills", headers=staff_headers["data_officer"]).json()[0]["id"], bill_id)
        self.assertEqual(
            self.client.get(f"/bills?department_id={department_id}", headers=admin).json()[0]["id"], bill_id
        )
        downloaded = self.client.get(f"/bills/{bill_id}/file", headers=admin)
        self.assertEqual(downloaded.status_code, 200, downloaded.text)
        self.assertTrue(downloaded.content.startswith(b"%PDF-"))

        self.assertEqual(self.client.get("/bills", headers=staff_headers["compliance_manager"]).status_code, 403)
        admin_upload = self.client.post(
            "/bills", headers=admin,
            data={"department_id": str(department_id)},
            files={"file": ("admin.pdf", b"%PDF-1.4\nadmin", "application/pdf")},
        )
        self.assertEqual(admin_upload.status_code, 201, admin_upload.text)
        admin_bill_id = admin_upload.json()["id"]
        self.assertEqual(self.client.post(
            "/bills", headers=staff_headers["data_officer"],
            files={"file": ("fake.pdf", b"not-a-pdf", "application/pdf")},
        ).status_code, 415)

        with Session(self.engine) as db:
            db.add_all((EmissionAnalysis(
                bill_id=UUID(bill_id), department_id=department_id, billing_period="2026-09",
                category="Electricity", usage_value=500, usage_unit="kWh", co2e_kg=350,
                confidence=0.85, summary="500 kWh estimated at 0.7 kg CO2e per kWh.",
                suggestions=["Replace remaining lights with LEDs."], model_name="test-model",
            ), EmissionAnalysis(
                bill_id=UUID(admin_bill_id), department_id=department_id, billing_period="2026-09",
                category="Natural Gas", usage_value=25, usage_unit="therms", co2e_kg=1200,
                confidence=0.8, summary="Gas use estimated from the bill.",
                suggestions=["Reduce heating demand."], model_name="test-model",
            )))
            db.commit()
        dashboard = self.client.get("/emissions", headers=staff_headers["compliance_manager"])
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        self.assertEqual(dashboard.json()["total_co2e_kg"], 1550)
        self.assertEqual(dashboard.json()["pending_credit_applications"], 1)
        self.assertEqual(dashboard.json()["monthly"][0]["period"], "2026-09")
        purchase = self.purchase(admin, "starter", department_id)
        self.assertEqual(purchase.status_code, 201, purchase.text)
        reconciled = self.client.post("/emissions/analyze", headers=staff_headers["compliance_manager"])
        self.assertEqual(reconciled.status_code, 200, reconciled.text)
        self.assertEqual(reconciled.json()["credits_used"], 2)
        self.assertEqual(reconciled.json()["pending_credit_applications"], 0)
        self.assertEqual(self.client.get("/credits/balance", headers=staff_headers["compliance_manager"]).json()["balance"], 98)
        history = self.client.get(f"/admin/credits/transactions?department_id={department_id}", headers=admin)
        self.assertEqual([item["kind"] for item in history.json()].count("emission_offset"), 1)
        again = self.client.post("/emissions/analyze", headers=staff_headers["compliance_manager"])
        self.assertEqual(again.status_code, 200, again.text)
        self.assertEqual(self.client.get("/credits/balance", headers=staff_headers["compliance_manager"]).json()["balance"], 98)
        # Reconcile an older per-bill rounding overcharge and return the extra credit.
        with Session(self.engine) as db:
            analyses = db.scalars(select(EmissionAnalysis)).all()
            for analysis in analyses:
                analysis.credits_used = 1 if analysis.co2e_kg < 1000 else 2
            account = db.scalar(select(CreditAccount).where(CreditAccount.department_id == department_id))
            account.balance = 97
            db.commit()
        refund = self.client.post("/emissions/analyze", headers=staff_headers["compliance_manager"])
        self.assertEqual(refund.status_code, 200, refund.text)
        self.assertEqual(refund.json()["credits_used"], 2)
        self.assertEqual(self.client.get("/credits/balance", headers=staff_headers["compliance_manager"]).json()["balance"], 98)
        self.assertEqual(self.client.get("/emissions", headers=staff_headers["data_officer"]).status_code, 403)
        self.assertEqual(
            self.client.get(f"/emissions?department_id={department_id}", headers=admin).status_code, 200
        )

    def test_google_drive_config_requires_bill_upload_access(self):
        admin = self.owner("drive-owner@example.com")
        department_id = self.department(admin, "Drive team")
        configured = self.client.get("/bills/google-drive/config", headers=admin)
        self.assertEqual(configured.status_code, 200, configured.text)
        self.assertFalse(configured.json()["configured"])
        created = self.client.post("/admin/users", headers=admin, json={
            "name": "Compliance", "email": "drive-compliance@example.com",
            "password": "a-strong-password", "role": "compliance_manager", "department_id": department_id,
        })
        self.assertEqual(created.status_code, 201, created.text)
        login = self.client.post("/auth/login", json={
            "email": "drive-compliance@example.com", "password": "a-strong-password",
        })
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        self.assertEqual(self.client.get("/bills/google-drive/config", headers=headers).status_code, 403)

    def test_signup_and_verified_purchase_send_transactional_emails(self):
        with patch("app.main.send_welcome_email") as welcome, patch("app.credits.send_purchase_receipt", return_value=True) as receipt:
            headers = self.owner("email-owner@example.com")
            welcome.assert_called_once_with("Owner", "email-owner@example.com")
            department_id = self.department(headers, "Email team")
            self.purchase(headers, "starter", department_id)
            receipt.assert_called_once()
            self.assertEqual(receipt.call_args.args[0:2], ("Owner", "email-owner@example.com"))


if __name__ == "__main__":
    unittest.main()
