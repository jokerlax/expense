# Expense ERP Enterprise System

A full-stack, 3-tier enterprise expense management system:
- **Frontend**: HTML5, CSS3, JavaScript, and Jinja2 Templates (`templates/` and `static/`)
- **Single-File Backend / Middleware**: `app.py` (Flask server, REST API, Jinja routes, MongoDB database manager, schema & seed initializer)
- **Database**: MongoDB (`seed_data.py` with automatic collections initialization & mongomock fallback)

---

## Project Structure

```
Expence/
├── app.py                      # Single-file Flask backend, MongoDB DB layer, API & routes
├── seed_data.py                # Canonical seed data definitions for MongoDB collections
├── requirements.txt            # Python dependencies (Flask, Jinja2, pymongo, mongomock, python-dotenv)
├── .env                        # MongoDB configuration
├── templates/                  # Jinja2 HTML Templates
│   ├── base.html               # Base layout template
│   ├── login.html              # SSO Login portal
│   ├── admin.html              # Administrator & Auditor portal
│   ├── employee.html           # Employee expense filing & reports
│   ├── manager.html            # Manager review & team approvals
│   └── finance.html            # Finance verification & payouts
├── static/                     # Static assets
│   ├── css/
│   │   └── index.css           # Styling & ERP theme
│   └── js/
│       ├── api.js              # REST API Client
│       ├── database.js         # Client-side DB bridge (syncs with Flask/DB)
│       ├── login.js            # Login page controller
│       ├── admin.js            # Admin page controller
│       ├── employee.js         # Employee page controller
│       ├── manager.js          # Manager page controller
│       └── finance.js          # Finance page controller
└── tests/
    └── test_api.py             # Automated API & DB unit tests
```

---

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Database (.env)
```env
# MongoDB Database Settings
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=ExpenseERP
MONGO_TIMEOUT_MS=3000
```
*(If MongoDB server is not running locally, the system automatically runs on an in-memory MongoDB fallback engine, ensuring zero downtime.)*

### 3. Run the Application
```bash
python app.py
```
Open your browser at **`http://127.0.0.1:5000`**.

---

## Default User Accounts

| Role | Email | Password |
|------|-------|----------|
| **Administrator** | `nikita@expense.com` | `admin123` |
| **Manager** | `sarah@expense.com` | `manager123` |
| **Finance** | `finance@expense.com` | `finance123` |
| **Employee** | `john@expense.com` | `employee123` |
| **Employee** | `david@expense.com` | `employee123` |
| **Auditor** | `auditor@expense.com` | `auditor123` |

---

## Running Automated Tests

```bash
python -m unittest discover -s tests
```

---

## Deploying to Render (Web Service)

1. Create a **New Web Service** on [Render](https://render.com).
2. Connect this repository.
3. Configure the service settings:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app` (or automatically read from `Procfile`)


