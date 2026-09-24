import unittest
import json
import os
from app import app, db_manager

class ExpenseErpApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = app
        cls.client = cls.app.test_client()
        cls.app.config["TESTING"] = True
        db_manager.init_db()

    def test_01_db_status(self):
        res = self.client.get("/api/db/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "success")
        self.assertIn("engine", data)

    def test_02_template_rendering(self):
        routes = ["/login", "/admin", "/employee", "/manager", "/finance"]
        for route in routes:
            res = self.client.get(route)
            self.assertEqual(res.status_code, 200, f"Route {route} failed to render")
            self.assertIn(b"EXPENSE", res.data)

    def test_03_auth_login_success(self):
        res = self.client.post("/api/auth/login", json={
            "email": "john@expense.com",
            "password": "employee123"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["name"], "John")
        self.assertEqual(data["user"]["role"], "Employee")

    def test_04_auth_login_failure(self):
        res = self.client.post("/api/auth/login", json={
            "email": "john@expense.com",
            "password": "wrongpassword"
        })
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data["success"])

    def test_05_get_table_data(self):
        tables = ["countries", "projects", "departments", "employees", "expenseCategories", "expenseTypes", "currencies", "users"]
        for tbl in tables:
            res = self.client.get(f"/api/data/{tbl}")
            self.assertEqual(res.status_code, 200, f"Table {tbl} failed to fetch")
            records = res.get_json()
            self.assertIsInstance(records, list)
            self.assertGreater(len(records), 0, f"Table {tbl} should not be empty")

    def test_06_expense_crud(self):
        # 1. Insert new expense
        test_exp = {
            "id": "EXP_TEST_001",
            "date": "2026-08-31",
            "employeeId": "EMP001",
            "employeeName": "John",
            "country": "ID",
            "project": "PRJ-JAK",
            "department": "IT",
            "category": "Travel",
            "type": "Taxi",
            "amount": 250000,
            "currency": "IDR",
            "paymentMethod": "Cash",
            "description": "Test Taxi Ride for verification",
            "receiptUrl": "receipt_taxi.jpg",
            "status": "UNREPORTED",
            "reportId": "",
            "remarks": "Automated Test",
            "dateCreated": "2026-08-31"
        }
        # Ensure clean state
        self.client.delete("/api/data/expenses/id/EXP_TEST_001")

        res_post = self.client.post("/api/data/expenses", json=test_exp)
        self.assertEqual(res_post.status_code, 201)

        # 2. Verify inserted
        res_get = self.client.get("/api/data/expenses")
        self.assertEqual(res_get.status_code, 200)
        items = [e for e in res_get.get_json() if e.get("id") == "EXP_TEST_001"]
        self.assertEqual(len(items), 1)
        self.assertEqual(float(items[0]["amount"]), 250000)

        # 3. Update expense
        res_put = self.client.put("/api/data/expenses/id/EXP_TEST_001", json={
            "amount": 300000,
            "status": "PENDING_MANAGER"
        })
        self.assertEqual(res_put.status_code, 200)

        # 4. Verify update
        res_get_updated = self.client.get("/api/data/expenses")
        updated_item = next(e for e in res_get_updated.get_json() if e.get("id") == "EXP_TEST_001")
        self.assertEqual(float(updated_item["amount"]), 300000)
        self.assertEqual(updated_item["status"], "PENDING_MANAGER")

        # 5. Delete expense
        res_del = self.client.delete("/api/data/expenses/id/EXP_TEST_001")
        self.assertEqual(res_del.status_code, 200)

        # 6. Verify deletion
        res_get_final = self.client.get("/api/data/expenses")
        remaining = [e for e in res_get_final.get_json() if e.get("id") == "EXP_TEST_001"]
        self.assertEqual(len(remaining), 0)

    def test_07_audit_log_creation(self):
        res = self.client.post("/api/audit-logs", json={
            "userId": "USR001",
            "userName": "John",
            "action": "Unit Test Action",
            "details": "Checking audit logging to DB."
        })
        self.assertEqual(res.status_code, 201)

        res_logs = self.client.get("/api/data/auditLogs")
        self.assertEqual(res_logs.status_code, 200)
        logs = res_logs.get_json()
        matching = [l for l in logs if l.get("action") == "Unit Test Action"]
        self.assertGreater(len(matching), 0)

    def test_08_all_data_bundle(self):
        res = self.client.get("/api/all-data")
        self.assertEqual(res.status_code, 200)
        bundle = res.get_json()
        self.assertIn("expenses", bundle)
        self.assertIn("reports", bundle)
        self.assertIn("users", bundle)
        self.assertIn("countries", bundle)

    def test_09_employee_and_role_user_creation(self):
        # 1. Create employee
        new_emp = {
            "id": "EMP_TEST_999",
            "name": "Alex Smith",
            "email": "alex@expense.com",
            "country": "US",
            "project": "PRJ-USA",
            "department": "IT",
            "manager": "Nikita",
            "designation": "DevOps Engineer",
            "grade": "Senior Staff",
            "costCenter": "CC001",
            "bankDetails": "Cleared",
            "status": "Active"
        }
        res_emp = self.client.post("/api/data/employees", json=new_emp)
        self.assertEqual(res_emp.status_code, 201)

        # 2. Create user account with assigned role
        new_user = {
            "id": "USR_TEST_999",
            "employeeId": "EMP_TEST_999",
            "name": "Alex Smith",
            "email": "alex@expense.com",
            "role": "Manager",
            "password": "alexmanager123",
            "status": "Active"
        }
        res_usr = self.client.post("/api/data/users", json=new_user)
        self.assertEqual(res_usr.status_code, 201)

        # 3. Validate login with the newly created employee role account
        res_login = self.client.post("/api/auth/login", json={
            "email": "alex@expense.com",
            "password": "alexmanager123"
        })
        self.assertEqual(res_login.status_code, 200)
        data = res_login.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["role"], "Manager")
        self.assertEqual(data["user"]["employeeId"], "EMP_TEST_999")

        # 4. Clean up test records
        self.client.delete("/api/data/users/id/USR_TEST_999")
        self.client.delete("/api/data/employees/id/EMP_TEST_999")

    def test_10_bulk_upsert_master_data(self):
        # Test bulk upsert for master entities
        bulk_countries = [
            {"code": "TEST_C1", "name": "Test Country 1", "currency": "USD", "status": "Active"},
            {"code": "TEST_C2", "name": "Test Country 2", "currency": "EUR", "status": "Active"}
        ]
        res = self.client.post("/api/data/countries/bulk", json=bulk_countries)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["count"], 2)

        # Verify they exist
        c1 = self.client.get("/api/data/countries").get_json()
        codes = [c["code"] for c in c1]
        self.assertIn("TEST_C1", codes)
        self.assertIn("TEST_C2", codes)

        # Bulk upsert with update
        bulk_update = [
            {"code": "TEST_C1", "name": "Test Country 1 Updated", "currency": "SGD", "status": "Active"}
        ]
        res_up = self.client.post("/api/data/countries/bulk", json=bulk_update)
        self.assertEqual(res_up.status_code, 200)

        # Clean up
        self.client.delete("/api/data/countries/code/TEST_C1")
        self.client.delete("/api/data/countries/code/TEST_C2")

        # Test bulk upsert with extra unmapped column (e.g. exchangeRate on Currencies)
        bulk_currencies = [
            {"code": "TEST_CUR", "name": "Test Currency", "symbol": "TC$", "decimalPlaces": 2, "exchangeRate": 1.25, "status": "Active"}
        ]
        res_curr = self.client.post("/api/data/currencies/bulk", json=bulk_currencies)
        self.assertEqual(res_curr.status_code, 200)
        curr_list = self.client.get("/api/data/currencies").get_json()
        curr_codes = [c["code"] for c in curr_list]
        self.assertIn("TEST_CUR", curr_codes)
        self.client.delete("/api/data/currencies/code/TEST_CUR")

    def test_11_client_user_license_limit(self):
        # 1. Get initial license configuration
        res = self.client.get("/api/license")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data["success"])
        self.assertIn("maxUsers", data)
        self.assertIn("activeUsers", data)
        self.assertIn("utilizationPct", data)

        # 2. Update license configuration (e.g. set limit to 50)
        res_update = self.client.post("/api/license", json={
            "maxUsers": 50,
            "clientName": "Test Commercial Client Corp",
            "licenseKey": "EXP-2026-TEST-50U",
            "licenseTier": "Professional Edition (50 Seats)"
        })
        self.assertEqual(res_update.status_code, 200)
        self.assertTrue(res_update.get_json()["success"])

        # 3. Verify updated config
        res_check = self.client.get("/api/license")
        check_data = res_check.get_json()
        self.assertEqual(check_data["maxUsers"], 50)
        self.assertEqual(check_data["clientName"], "Test Commercial Client Corp")

        # 4. Test license enforcement by temporarily setting limit equal to current active count
        current_active = check_data["activeUsers"]
        self.client.post("/api/license", json={"maxUsers": current_active})

        # Attempt to insert new employee beyond license limit
        over_emp = {
            "id": "EMP_OVER_LIMIT",
            "name": "Over Limit User",
            "email": "overlimit@expense.com",
            "status": "Active"
        }
        res_fail = self.client.post("/api/data/employees", json=over_emp)
        self.assertEqual(res_fail.status_code, 403)
        fail_data = res_fail.get_json()
        self.assertEqual(fail_data["error_code"], "LICENSE_LIMIT_EXCEEDED")

        # 5. Restore limit to 50
        self.client.post("/api/license", json={"maxUsers": 50})

    def test_12_bulk_import_with_extra_fields_and_aliases(self):
        # Test bulk import containing metadata fields (like isValid, errors) and alias headers (like empId, corp_email)
        records = [
            {
                "empId": "EMP_BULK_01",
                "employeeName": "Bulk User One",
                "corporateEmail": "bulk1@expense.com",
                "dept": "Engineering",
                "manager": "EMP001",
                "isValid": True,
                "isExisting": False,
                "errors": []
            },
            {
                "id": "EMP_BULK_02",
                "name": "Bulk User Two",
                "email": "bulk2@expense.com",
                "department": "Sales",
                "isValid": True,
                "random_extra_col": 12345
            }
        ]
        res = self.client.post("/api/data/employees/bulk", json=records)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.get_json()["count"], 2)

        # Verify records exist and extra columns were stripped
        emp1 = self.client.get("/api/data/employees").get_json()
        ids = [e["id"] for e in emp1]
        self.assertIn("EMP_BULK_01", ids)
        self.assertIn("EMP_BULK_02", ids)

        # Clean up
        self.client.delete("/api/data/employees/id/EMP_BULK_01")
        self.client.delete("/api/data/employees/id/EMP_BULK_02")

    def test_13_bulk_user_import_with_custom_password(self):
        # 1. Bulk import an employee
        emp = [{
            "id": "EMP_PWD_01",
            "name": "Password Tester",
            "email": "pwdtester@expense.com",
            "status": "Active"
        }]
        res_emp = self.client.post("/api/data/employees/bulk", json=emp)
        self.assertEqual(res_emp.status_code, 200)

        # 2. Bulk import user account with custom password specified in spreadsheet
        custom_password = "MySecurePass2026!#"
        users = [{
            "id": "USR_PWD_01",
            "employeeId": "EMP_PWD_01",
            "name": "Password Tester",
            "email": "pwdtester@expense.com",
            "role": "Employee",
            "password": custom_password,
            "status": "Active"
        }]
        res_user = self.client.post("/api/data/users/bulk", json=users)
        self.assertEqual(res_user.status_code, 200)

        # 3. Authenticate with the custom password from Excel
        res_login = self.client.post("/api/auth/login", json={
            "email": "pwdtester@expense.com",
            "password": custom_password
        })
        self.assertEqual(res_login.status_code, 200)
        data = res_login.get_json()
        self.assertTrue(data["success"])
        self.assertEqual(data["user"]["email"], "pwdtester@expense.com")

        # 4. Update the user with a new password via bulk upsert
        updated_password = "BrandNewPassword789!"
        users_update = [{
            "id": "USR_PWD_01",
            "employeeId": "EMP_PWD_01",
            "name": "Password Tester",
            "email": "pwdtester@expense.com",
            "role": "Employee",
            "password": updated_password,
            "status": "Active"
        }]
        res_up = self.client.post("/api/data/users/bulk", json=users_update)
        self.assertEqual(res_up.status_code, 200)

        # 5. Verify old password fails and new password succeeds
        res_fail = self.client.post("/api/auth/login", json={
            "email": "pwdtester@expense.com",
            "password": custom_password
        })
        self.assertEqual(res_fail.status_code, 401)

        res_pass = self.client.post("/api/auth/login", json={
            "email": "pwdtester@expense.com",
            "password": updated_password
        })
        self.assertEqual(res_pass.status_code, 200)
        self.assertTrue(res_pass.get_json()["success"])

        # 6. Clean up
        self.client.delete("/api/data/users/id/USR_PWD_01")
        self.client.delete("/api/data/employees/id/EMP_PWD_01")

if __name__ == "__main__":
    unittest.main()
