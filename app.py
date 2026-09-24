import os
import sys
import json
import datetime
import re
import copy
from dotenv import load_dotenv
from pymongo import MongoClient
import mongomock
from seed_data import DEFAULT_SEEDS

load_dotenv()

# ==============================================================================
# CONFIGURATION
# ==============================================================================

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'expense-erp-super-secret-key-2026')
    
    # =========================================================================
    # COMMERCIAL CLIENT LICENSE & USER RESTRICTION (CODE-LEVEL CONTROL)
    # =========================================================================
    # Set the user limit here before distributing/selling to client (e.g. 50 users)
    MAX_USER_LICENSE = int(os.environ.get('MAX_USER_LICENSE', 50))
    CLIENT_NAME = os.environ.get('CLIENT_NAME', 'Enterprise Commercial Client')
    LICENSE_KEY = os.environ.get('LICENSE_KEY', 'EXP-2026-ENT-50U-COMMERCIAL')
    LICENSE_TIER = os.environ.get('LICENSE_TIER', 'Professional Edition (50 Seats)')
    ENFORCE_HARD_LICENSE_LIMIT = True
    
    # MongoDB Database Settings
    MONGO_URI = os.environ.get('MONGO_URI', 'mongodb://localhost:27017/')
    MONGO_DB_NAME = os.environ.get('MONGO_DB_NAME', 'ExpenseERP')
    MONGO_TIMEOUT_MS = int(os.environ.get('MONGO_TIMEOUT_MS', 3000))
    
    # Port & Host
    PORT = int(os.environ.get('PORT', 5000))
    HOST = os.environ.get('HOST', '0.0.0.0')
    DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 't')

# ==============================================================================
# MONGODB DATABASE LAYER & ADAPTER
# ==============================================================================

# Table name mapping dictionary (case-insensitive and camelCase to SQL Table names)
TABLE_MAP = {
    "countries": "Countries",
    "projects": "Projects",
    "departments": "Departments",
    "employees": "Employees",
    "users": "Users",
    "roles": "Roles",
    "permissions": "Permissions",
    "expensecategories": "ExpenseCategories",
    "expenseCategories": "ExpenseCategories",
    "expensetypes": "ExpenseTypes",
    "expenseTypes": "ExpenseTypes",
    "currencies": "Currencies",
    "paymentmethods": "PaymentMethods",
    "paymentMethods": "PaymentMethods",
    "approvalworkflows": "ApprovalWorkflows",
    "approvalWorkflows": "ApprovalWorkflows",
    "approvers": "Approvers",
    "expensepolicies": "ExpensePolicies",
    "expensePolicies": "ExpensePolicies",
    "employeegrades": "EmployeeGrades",
    "employeeGrades": "EmployeeGrades",
    "costcenters": "CostCenters",
    "costCenters": "CostCenters",
    "locations": "Locations",
    "taxmasters": "TaxMasters",
    "taxMasters": "TaxMasters",
    "documenttypes": "DocumentTypes",
    "documentTypes": "DocumentTypes",
    "expenses": "Expenses",
    "reports": "Reports",
    "reimbursements": "Reimbursements",
    "reasons": "Reasons",
    "expensestatuses": "ExpenseStatuses",
    "expenseStatuses": "ExpenseStatuses",
    "auditlogs": "AuditLogs",
    "auditLogs": "AuditLogs",
    "settlements": "Settlements",
    "systemconfig": "SystemConfig",
    "systemConfig": "SystemConfig"
}

def resolve_table_name(table_input):
    clean = table_input.strip()
    return TABLE_MAP.get(clean, TABLE_MAP.get(clean.lower(), clean))

TABLE_COLUMNS = {
    "Countries": ["code", "name", "currency", "status"],
    "Projects": ["code", "name", "country", "manager", "startDate", "endDate", "status"],
    "Departments": ["code", "name", "manager", "status"],
    "Employees": ["id", "name", "email", "country", "project", "department", "manager", "designation", "grade", "costCenter", "bankDetails", "status"],
    "Users": ["id", "employeeId", "name", "email", "role", "password", "status"],
    "Roles": ["name", "desc", "status"],
    "Permissions": ["role", "userSetup", "addExpense", "approveExpense", "financeVerify", "reports", "systemSetup"],
    "ExpenseCategories": ["code", "name", "icon", "status"],
    "ExpenseTypes": ["code", "category", "name", "limit", "currency", "status"],
    "Currencies": ["code", "name", "symbol", "decimalPlaces", "status"],
    "PaymentMethods": ["code", "name", "status"],
    "ApprovalWorkflows": ["code", "name", "description", "status"],
    "Approvers": ["id", "project", "department", "level", "approver"],
    "ExpensePolicies": ["id", "type", "limit", "currency", "scope", "action"],
    "EmployeeGrades": ["name", "description"],
    "CostCenters": ["code", "name", "status"],
    "Locations": ["code", "name", "country", "status"],
    "TaxMasters": ["code", "name", "rate", "country", "status"],
    "DocumentTypes": ["name", "status"],
    "Expenses": ["id", "date", "employeeId", "employeeName", "country", "project", "department", "category", "type", "amount", "currency", "paymentMethod", "description", "receiptUrl", "status", "reportId", "remarks", "dateCreated"],
    "Reports": ["id", "title", "startDate", "endDate", "approver", "verifier", "employeeId", "employeeName", "status", "totalAmount", "dateCreated"],
    "Reimbursements": ["id", "reportId", "employeeId", "amount", "currency", "paidDate", "paymentMethod", "referenceNo", "remarks", "status"],
    "Reasons": ["code", "name", "type"],
    "ExpenseStatuses": ["code", "label"],
    "AuditLogs": ["id", "timestamp", "userId", "userName", "action", "details"],
    "Settlements": ["id", "employeeId", "employeeName", "type", "mode", "amount", "currency", "balanceBefore", "balanceAfter", "notes", "settledBy", "dateCreated"],
    "SystemConfig": ["key", "value", "description", "updatedAt"]
}

class DatabaseManager:
    def __init__(self):
        self.is_mongo = False
        self.is_mock = False
        self.mongo_uri = Config.MONGO_URI
        self.db_name = Config.MONGO_DB_NAME
        self.client = None
        self.db = None
        self.active_engine = "Unknown"
        self._init_connection()

    def _init_connection(self):
        try:
            client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=Config.MONGO_TIMEOUT_MS)
            client.admin.command('ping')
            self.client = client
            self.db = self.client[self.db_name]
            self.is_mongo = True
            self.is_mock = False
            self.active_engine = "MongoDB"
            print(f"[DB] Successfully connected to MongoDB: {self.mongo_uri} (Database: {self.db_name})")
        except Exception as e:
            try:
                self.client = mongomock.MongoClient()
                self.db = self.client[self.db_name]
                self.is_mongo = True
                self.is_mock = True
                self.active_engine = "MongoDB (Local Fallback)"
                print(f"[DB Notice] Live MongoDB server unavailable at {self.mongo_uri} ({e}). Running on local MongoDB engine fallback.")
            except Exception as e_mock:
                self.is_mongo = False
                self.active_engine = "Unavailable"
                print(f"[DB Fatal] Could not initialize MongoDB engine: {e_mock}")

    def test_connection(self):
        try:
            if not self.is_mock:
                self.client.admin.command('ping')
            return {
                "status": "success",
                "engine": self.active_engine,
                "is_mongo": self.is_mongo,
                "database": self.db_name,
                "is_mock": self.is_mock
            }
        except Exception as e:
            return {"status": "error", "message": str(e), "engine": self.active_engine}

    def get_collection(self, table_name):
        tbl = resolve_table_name(table_name)
        return self.db[tbl]

    def init_db(self):
        """Seed collections if empty"""
        try:
            users_col = self.get_collection("Users")
            if users_col.count_documents({}) == 0:
                for tbl, records in DEFAULT_SEEDS.items():
                    col = self.get_collection(tbl)
                    if records and col.count_documents({}) == 0:
                        docs = [copy.deepcopy(r) for r in records]
                        for d in docs:
                            d.pop("_id", None)
                        col.insert_many(docs)
                print(f"[DB] {self.active_engine} database initialized and seeded successfully.")
        except Exception as e:
            print(f"[DB Error init_db]: {e}")

    def get_all(self, table_name):
        try:
            col = self.get_collection(table_name)
            docs = list(col.find({}, {"_id": 0}))
            return docs
        except Exception as e:
            print(f"[DB Error get_all] {table_name}: {e}")
            return []

    def get_by_id(self, table_name, key_name, key_val):
        try:
            col = self.get_collection(table_name)
            doc = col.find_one({key_name: key_val}, {"_id": 0})
            if not doc and isinstance(key_val, str):
                doc = col.find_one({key_name: {"$regex": f"^{re.escape(key_val)}$", "$options": "i"}}, {"_id": 0})
            return doc
        except Exception as e:
            print(f"[DB Error get_by_id] {table_name}: {e}")
            return None

    def sanitize_record(self, table_name, record_dict):
        if not isinstance(record_dict, dict):
            return {}
        tbl = resolve_table_name(table_name)
        valid_cols = TABLE_COLUMNS.get(tbl)
        if not valid_cols:
            return record_dict

        allowed_map = {col.lower(): col for col in valid_cols}
        alias_map = {
            "empid": "id",
            "emp_id": "id",
            "employee_id": "id" if tbl == "Employees" else "employeeId",
            "employeeid": "id" if tbl == "Employees" else "employeeId",
            "fullname": "name" if tbl not in ["Expenses", "Reports", "Settlements"] else "employeeName",
            "employeename": "name" if tbl not in ["Expenses", "Reports", "Settlements"] else "employeeName",
            "employee_name": "name" if tbl not in ["Expenses", "Reports", "Settlements"] else "employeeName",
            "corporateemail": "email",
            "corp_email": "email",
            "mail": "email",
            "dept": "department",
            "department_name": "department",
            "bank": "bankDetails",
            "bank_details": "bankDetails",
            "bankaccount": "bankDetails",
            "bank_account": "bankDetails",
            "costcenter": "costCenter",
            "cost_center": "costCenter",
            "start_date": "startDate",
            "end_date": "endDate",
            "decimal_places": "decimalPlaces",
            "decimalplaces": "decimalPlaces",
            "payment_method": "paymentMethod",
            "receipt_url": "receiptUrl",
            "report_id": "reportId",
            "date_created": "dateCreated",
            "total_amount": "totalAmount",
            "paid_date": "paidDate",
            "reference_no": "referenceNo",
            "ref_no": "referenceNo",
            "balance_before": "balanceBefore",
            "balance_after": "balanceAfter",
            "settled_by": "settledBy",
            "user_id": "userId",
            "user_name": "userName",
            "updated_at": "updatedAt"
        }

        cleaned = {}
        for k, v in record_dict.items():
            if k is None:
                continue
            k_clean = str(k).strip()
            k_lower = k_clean.lower()
            
            target_col = None
            if k_lower in allowed_map:
                target_col = allowed_map[k_lower]
            elif k_lower in alias_map:
                mapped_key = alias_map[k_lower]
                if mapped_key.lower() in allowed_map:
                    target_col = allowed_map[mapped_key.lower()]
            
            if target_col:
                if isinstance(v, str):
                    cleaned[target_col] = v.strip()
                else:
                    cleaned[target_col] = v
                    
        return cleaned

    def insert_record(self, table_name, record_dict):
        try:
            tbl = resolve_table_name(table_name)
            cleaned = self.sanitize_record(table_name, record_dict)
            if not cleaned:
                return False
            cleaned.pop("_id", None)
            col = self.get_collection(tbl)
            col.insert_one(cleaned)
            return True
        except Exception as e:
            print(f"[DB Error insert_record] {table_name}: {e}")
            return False

    def update_record(self, table_name, match_key, match_val, update_dict):
        try:
            tbl = resolve_table_name(table_name)
            cleaned = self.sanitize_record(table_name, update_dict)
            if not cleaned:
                return False
            cleaned.pop("_id", None)
            col = self.get_collection(tbl)
            filter_q = {match_key: match_val}
            res = col.update_one(filter_q, {"$set": cleaned})
            if res.matched_count == 0 and isinstance(match_val, str):
                res = col.update_one(
                    {match_key: {"$regex": f"^{re.escape(match_val)}$", "$options": "i"}},
                    {"$set": cleaned}
                )
            return (res.matched_count > 0 or res.modified_count > 0)
        except Exception as e:
            print(f"[DB Error update_record] {table_name}: {e}")
            return False

    def delete_record(self, table_name, match_key, match_val):
        try:
            tbl = resolve_table_name(table_name)
            col = self.get_collection(tbl)
            res = col.delete_one({match_key: match_val})
            if res.deleted_count == 0 and isinstance(match_val, str):
                res = col.delete_one({match_key: {"$regex": f"^{re.escape(match_val)}$", "$options": "i"}})
            return res.deleted_count > 0
        except Exception as e:
            print(f"[DB Error delete_record] {table_name}: {e}")
            return False

    def bulk_upsert(self, table_name, records):
        if not records:
            return 0
        tbl = resolve_table_name(table_name)
        if tbl in ["Countries", "Projects", "Departments", "Currencies", "ExpenseCategories", "ExpenseTypes", "PaymentMethods", "ApprovalWorkflows", "Reasons", "ExpenseStatuses", "TaxMasters", "Locations", "CostCenters"]:
            pk = "code"
        elif tbl in ["Employees", "Users", "Expenses", "Reports", "Reimbursements", "AuditLogs", "Settlements", "Approvers"]:
            pk = "id"
        elif tbl in ["SystemConfig"]:
            pk = "key"
        elif tbl in ["Permissions"]:
            pk = "role"
        else:
            pk = "name"
        
        count = 0
        for raw_r in records:
            if not isinstance(raw_r, dict):
                continue
            r = self.sanitize_record(table_name, raw_r)
            if not r:
                continue
            match_val = r.get(pk)
            if match_val and self.get_by_id(table_name, pk, match_val):
                if self.update_record(table_name, pk, match_val, r):
                    count += 1
            else:
                if self.insert_record(table_name, r):
                    count += 1
        return count

    def validate_login(self, email, password):
        try:
            col = self.get_collection("Users")
            user = col.find_one({
                "email": {"$regex": f"^{re.escape(email.strip())}$", "$options": "i"},
                "password": password,
                "status": "Active"
            }, {"_id": 0})
            if not user:
                return None

            emp_id = user.get("employeeId")
            if emp_id:
                emp_col = self.get_collection("Employees")
                emp = emp_col.find_one({"id": emp_id}, {"_id": 0})
                if emp:
                    user["employeeDetails"] = emp

            return user
        except Exception as e:
            print(f"[DB Error validate_login]: {e}")
            return None

    def add_audit_log(self, user_id, user_name, action, details):
        log_id = f"LOG{int(datetime.datetime.now().timestamp() * 1000)}"
        timestamp = datetime.datetime.now().isoformat()
        return self.insert_record("AuditLogs", {
            "id": log_id,
            "timestamp": timestamp,
            "userId": user_id,
            "userName": user_name,
            "action": action,
            "details": str(details)
        })

    def get_license_config(self):
        """Fetch client user license configuration with Config.MAX_USER_LICENSE taking code-level default"""
        configs = self.get_all("SystemConfig")
        config_map = {c.get("key"): c.get("value") for c in configs if isinstance(c, dict)}
        
        default_max = Config.MAX_USER_LICENSE if hasattr(Config, 'MAX_USER_LICENSE') and Config.MAX_USER_LICENSE is not None else 50
        try:
            max_users = int(config_map.get("MAX_USER_LICENSE", default_max))
        except (ValueError, TypeError):
            max_users = default_max

        default_client = Config.CLIENT_NAME if (hasattr(Config, 'CLIENT_NAME') and Config.CLIENT_NAME) else "Enterprise Commercial Client"
        client_name = config_map.get("CLIENT_NAME", default_client)

        default_key = Config.LICENSE_KEY if (hasattr(Config, 'LICENSE_KEY') and Config.LICENSE_KEY) else "EXP-2026-ENT-50U-COMMERCIAL"
        license_key = config_map.get("LICENSE_KEY", default_key)

        default_tier = Config.LICENSE_TIER if (hasattr(Config, 'LICENSE_TIER') and Config.LICENSE_TIER) else f"Professional Edition ({max_users} Seats)"
        license_tier = config_map.get("LICENSE_TIER", default_tier)

        return {
            "maxUsers": max_users,
            "clientName": client_name,
            "licenseKey": license_key,
            "licenseTier": license_tier,
            "licenseExpiry": config_map.get("LICENSE_EXPIRY", "2027-12-31"),
            "updatedAt": config_map.get("updatedAt", "")
        }

    def get_active_user_count(self):
        """Count distinct active employee/user accounts"""
        employees = self.get_all("Employees")
        active_emps = [e for e in employees if isinstance(e, dict) and e.get("status", "Active") == "Active"]
        return len(active_emps)

    def check_license_capacity(self, additional_users=1):
        """Validate if adding new users exceeds configured client license limit"""
        cfg = self.get_license_config()
        current_active = self.get_active_user_count()
        max_limit = cfg["maxUsers"]
        if current_active + additional_users > max_limit:
            return False, current_active, max_limit
        return True, current_active, max_limit

    def reset_database(self):
        """Wipes and reseeds the database with clean master seeds"""
        try:
            for tbl_name in DEFAULT_SEEDS.keys():
                col = self.get_collection(tbl_name)
                col.delete_many({})

            for tbl, records in DEFAULT_SEEDS.items():
                col = self.get_collection(tbl)
                if records:
                    docs = [copy.deepcopy(r) for r in records]
                    for d in docs:
                        d.pop("_id", None)
                    col.insert_many(docs)
            return True
        except Exception as e:
            print(f"[DB Error reset_database]: {e}")
            return False

# Global database manager instance
db_manager = DatabaseManager()

# ==============================================================================
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import jinja2

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config.from_object(Config)

# Fallback template loader for root and templates directory
base_dir = os.path.dirname(os.path.abspath(__file__))
app.jinja_loader = jinja2.ChoiceLoader([
    jinja2.FileSystemLoader(os.path.join(base_dir, "templates")),
    jinja2.FileSystemLoader(base_dir)
])

# Auto-initialize Database on Startup
with app.app_context():
    db_manager.init_db()

@app.route("/")
def index():
    user = session.get("user")
    if user:
        role = user.get("role")
        if role in ["Administrator", "Auditor"]:
            return redirect(url_for("admin_view"))
        elif role == "Manager":
            return redirect(url_for("manager_view"))
        elif role == "Finance":
            return redirect(url_for("finance_view"))
        elif role == "Employee":
            return redirect(url_for("employee_view"))
    return redirect(url_for("login_view"))

@app.route("/login")
def login_view():
    return render_template("login.html", user=session.get("user"), db_engine=db_manager.active_engine)

@app.route("/admin")
def admin_view():
    return render_template("admin.html", user=session.get("user"), db_engine=db_manager.active_engine)

@app.route("/employee")
def employee_view():
    return render_template("employee.html", user=session.get("user"), db_engine=db_manager.active_engine)

@app.route("/manager")
def manager_view():
    return render_template("manager.html", user=session.get("user"), db_engine=db_manager.active_engine)

@app.route("/finance")
def finance_view():
    return render_template("finance.html", user=session.get("user"), db_engine=db_manager.active_engine)

@app.route("/logout")
def logout_view():
    user = session.pop("user", None)
    if user:
        db_manager.add_audit_log(user.get("employeeId", "USR"), user.get("name", "User"), "Logout", "User logged out.")
    return redirect(url_for("login_view"))

@app.route("/index.css")
def serve_root_index_css():
    return app.send_static_file("css/index.css")

@app.route("/xlsx.full.min.js")
def serve_root_xlsx():
    return app.send_static_file("js/xlsx.full.min.js")

@app.route("/<file_name>.js")
def serve_root_js_file(file_name):
    js_path = os.path.join(app.static_folder, "js", f"{file_name}.js")
    if os.path.exists(js_path):
        return app.send_static_file(f"js/{file_name}.js")
    root_path = os.path.join(os.path.dirname(__file__), f"{file_name}.js")
    if os.path.exists(root_path):
        from flask import send_from_directory
        return send_from_directory(os.path.dirname(__file__), f"{file_name}.js")
    return ("Not Found", 404)

# ==============================================================================
# RESTFUL JSON API ROUTES (LIVE DATA FROM MS SQL / DATABASE)
# ==============================================================================
@app.route("/api/auth/login", methods=["POST"])
def api_login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    user = db_manager.validate_login(email, password)
    if user:
        safe_user = dict(user)
        safe_user.pop("password", None)
        session["user"] = safe_user
        db_manager.add_audit_log(
            user.get("employeeId", user.get("id")),
            user.get("name"),
            "Login Successful",
            f"User {user.get('name')} authenticated from {request.remote_addr}."
        )
        return jsonify({"success": True, "user": safe_user})
    return jsonify({"success": False, "message": "Invalid email or password."}), 401

@app.route("/api/auth/session", methods=["GET"])
def api_session():
    user = session.get("user")
    if user:
        return jsonify({"authenticated": True, "user": user})
    return jsonify({"authenticated": False, "user": None}), 401

@app.route("/api/auth/logout", methods=["POST"])
def api_logout():
    user = session.pop("user", None)
    if user:
        db_manager.add_audit_log(
            user.get("employeeId", user.get("id")),
            user.get("name"),
            "Logout",
            f"User {user.get('name')} logged out."
        )
    return jsonify({"success": True, "message": "Logged out successfully."})

@app.route("/api/data/<table_name>", methods=["GET"])
def api_get_table(table_name):
    return jsonify(db_manager.get_all(table_name))

@app.route("/api/data/<table_name>", methods=["POST"])
def api_insert_record(table_name):
    record = request.get_json() or {}
    if not record:
        return jsonify({"success": False, "message": "No data provided."}), 400

    # License capacity check for employees / users
    if table_name.lower() in ["employees", "users"]:
        allowed, current_users, max_limit = db_manager.check_license_capacity(1)
        if not allowed:
            return jsonify({
                "success": False,
                "error_code": "LICENSE_LIMIT_EXCEEDED",
                "message": f"Client User License Limit Reached ({current_users}/{max_limit} active seats). Please increase the client license limit in Database Setup / Settings to add more personnel.",
                "currentUsers": current_users,
                "maxUsers": max_limit
            }), 403

    if db_manager.insert_record(table_name, record):
        return jsonify({"success": True, "record": record}), 201
    return jsonify({"success": False, "message": f"Failed to insert record into {table_name}."}), 500

@app.route("/api/data/<table_name>/bulk", methods=["POST"])
def api_bulk_upsert(table_name):
    records = request.get_json() or []
    if not isinstance(records, list):
        records = [records]

    # License capacity check for bulk employee/user imports (count only new entries)
    if table_name.lower() in ["employees", "users"]:
        tbl = resolve_table_name(table_name)
        new_count = 0
        for r in records:
            if not isinstance(r, dict):
                continue
            emp_id = r.get("id") or r.get("employeeId") or r.get("empid")
            email = r.get("email")
            exists = False
            if emp_id and db_manager.get_by_id(tbl, "id", emp_id):
                exists = True
            elif email and db_manager.get_by_id(tbl, "email", email):
                exists = True
            if not exists:
                new_count += 1

        if new_count > 0:
            allowed, current_users, max_limit = db_manager.check_license_capacity(new_count)
            if not allowed:
                return jsonify({
                    "success": False,
                    "error_code": "LICENSE_LIMIT_EXCEEDED",
                    "message": f"Cannot import {new_count} new personnel. Client license allows up to {max_limit} seats (currently {current_users} active). Please upgrade client license in Database Setup.",
                    "currentUsers": current_users,
                    "maxUsers": max_limit
                }), 403

    count = db_manager.bulk_upsert(table_name, records)
    return jsonify({"success": True, "count": count})

@app.route("/api/data/<table_name>/<key_name>/<key_val>", methods=["PUT"])
def api_update_record(table_name, key_name, key_val):
    update_data = request.get_json() or {}
    if not update_data:
        return jsonify({"success": False, "message": "No update data provided."}), 400
    if db_manager.update_record(table_name, key_name, key_val, update_data):
        return jsonify({"success": True, "message": "Record updated."})
    return jsonify({"success": False, "message": f"Failed to update record in {table_name}."}), 500

@app.route("/api/data/<table_name>/<key_name>/<key_val>", methods=["DELETE"])
def api_delete_record(table_name, key_name, key_val):
    if db_manager.delete_record(table_name, key_name, key_val):
        return jsonify({"success": True, "message": "Record deleted."})
    return jsonify({"success": False, "message": f"Failed to delete record in {table_name}."}), 500

@app.route("/api/license", methods=["GET"])
def api_get_license():
    cfg = db_manager.get_license_config()
    current = db_manager.get_active_user_count()
    max_u = cfg["maxUsers"]
    utilization = round((current / max_u * 100), 1) if max_u > 0 else 0
    return jsonify({
        "success": True,
        "maxUsers": max_u,
        "activeUsers": current,
        "availableSlots": max(0, max_u - current),
        "utilizationPct": utilization,
        "isLimitReached": current >= max_u,
        "clientName": cfg["clientName"],
        "licenseKey": cfg["licenseKey"],
        "licenseTier": cfg["licenseTier"],
        "licenseExpiry": cfg["licenseExpiry"],
        "updatedAt": cfg["updatedAt"]
    })

@app.route("/api/license", methods=["POST", "PUT"])
def api_update_license():
    data = request.get_json() or {}
    max_users = data.get("maxUsers") or data.get("max_users") or data.get("MAX_USER_LICENSE")
    client_name = data.get("clientName") or data.get("CLIENT_NAME")
    license_key = data.get("licenseKey") or data.get("LICENSE_KEY")
    license_tier = data.get("licenseTier") or data.get("LICENSE_TIER")
    license_expiry = data.get("licenseExpiry") or data.get("LICENSE_EXPIRY")
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if max_users is not None:
        try:
            max_users_val = str(int(max_users))
            if int(max_users_val) < 1:
                return jsonify({"success": False, "message": "License limit must be at least 1 user."}), 400
            db_manager.bulk_upsert("SystemConfig", [{"key": "MAX_USER_LICENSE", "value": max_users_val, "description": "Maximum allowed active user / employee client licenses", "updatedAt": now_str}])
        except ValueError:
            return jsonify({"success": False, "message": "Invalid user license limit value."}), 400

    if client_name:
        db_manager.bulk_upsert("SystemConfig", [{"key": "CLIENT_NAME", "value": str(client_name), "description": "Licensed Client Organization Name", "updatedAt": now_str}])
    if license_key:
        db_manager.bulk_upsert("SystemConfig", [{"key": "LICENSE_KEY", "value": str(license_key), "description": "Product Commercial License Key", "updatedAt": now_str}])
    if license_tier:
        db_manager.bulk_upsert("SystemConfig", [{"key": "LICENSE_TIER", "value": str(license_tier), "description": "Subscription License Tier", "updatedAt": now_str}])
    if license_expiry:
        db_manager.bulk_upsert("SystemConfig", [{"key": "LICENSE_EXPIRY", "value": str(license_expiry), "description": "License Expiration Date", "updatedAt": now_str}])

    user = session.get("user")
    user_id = user.get("employeeId", "ADM001") if user else "SYSTEM"
    user_name = user.get("name", "Administrator") if user else "Administrator"
    db_manager.add_audit_log(
        user_id,
        user_name,
        "Update License Config",
        f"Admin updated client user license limit to {max_users or 50} seats for '{client_name or 'Client'}'."
    )
    return jsonify({
        "success": True,
        "message": "Client license configuration saved successfully.",
        "config": db_manager.get_license_config()
    })

@app.route("/api/audit-logs", methods=["POST"])
def api_add_audit_log():
    data = request.get_json() or {}
    success = db_manager.add_audit_log(
        data.get("userId", "ANONYMOUS"),
        data.get("userName", "System"),
        data.get("action", "Action"),
        data.get("details", "")
    )
    if success:
        return jsonify({"success": True}), 201
    return jsonify({"success": False}), 500

@app.route("/api/db/status", methods=["GET"])
def api_db_status():
    return jsonify(db_manager.test_connection())

@app.route("/api/db/reset", methods=["POST"])
def api_db_reset():
    user = session.get("user")
    if db_manager.reset_database():
        user_id = user.get("employeeId", "USR004") if user else "SYSTEM"
        user_name = user.get("name", "Administrator") if user else "System Admin"
        db_manager.add_audit_log(user_id, user_name, "Database Reset", "System reset to default seed records.")
        return jsonify({"success": True, "message": "Database reset to initial seed state."})
    return jsonify({"success": False, "message": "Failed to reset database."}), 500

@app.route("/api/all-data", methods=["GET"])
def api_get_all_data():
    tables = [
        "countries", "projects", "departments", "employees", "users",
        "roles", "permissions", "expenseCategories", "expenseTypes",
        "currencies", "paymentMethods", "approvalWorkflows", "approvers",
        "expensePolicies", "employeeGrades", "costCenters", "locations",
        "taxMasters", "documentTypes", "expenses", "reports",
        "reimbursements", "reasons", "expenseStatuses", "auditLogs", "settlements", "systemConfig"
    ]
    return jsonify({tbl: db_manager.get_all(tbl) for tbl in tables})

if __name__ == "__main__":
    print("=" * 65)
    print("  EXPENSE ERP - SINGLE FILE BACKEND (FLASK + JINJA + MONGODB)")
    print("=" * 65)
    print(f"  * URL: http://{Config.HOST}:{Config.PORT}")
    print(f"  * Database: {db_manager.active_engine}")
    print("=" * 65)
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
