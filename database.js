// Expense Management System - Local Storage Database Layer

const DEFAULT_SEEDS = {
  countries: [
    { code: "ID", name: "Indonesia", currency: "IDR", status: "Active" },
    { code: "IN", name: "India", currency: "INR", status: "Active" },
    { code: "US", name: "United States", currency: "USD", status: "Active" },
    { code: "DE", name: "Germany", currency: "EUR", status: "Active" }
  ],
  projects: [
    { code: "PRJ-JAK", name: "Jakarta Project", country: "ID", manager: "Sarah", startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
    { code: "PRJ-MUM", name: "Mumbai Tech", country: "IN", manager: "Sarah", startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
    { code: "PRJ-DEL", name: "Delhi Project", country: "IN", manager: "Sarah", startDate: "2026-01-01", endDate: "2026-12-31", status: "Active" },
    { code: "PRJ-USA", name: "US HQ Expansion", country: "US", manager: "Nikita", startDate: "2026-03-01", endDate: "2027-03-01", status: "Active" },
    { code: "PRJ-MUN", name: "Munich Lab", country: "DE", manager: "Nikita", startDate: "2026-05-01", endDate: "2026-11-30", status: "Active" }
  ],
  departments: [
    { code: "IT", name: "Information Technology", manager: "Nikita", status: "Active" },
    { code: "FIN", name: "Finance & Accounts", manager: "Finance User", status: "Active" },
    { code: "HR", name: "Human Resources", manager: "HR Manager", status: "Active" },
    { code: "SAL", name: "Sales & Marketing", manager: "Nikita", status: "Active" },
    { code: "OPS", name: "Operations", manager: "Ops Manager", status: "Active" }
  ],
  employees: [
    { id: "EMP001", name: "John", email: "john@expense.com", country: "ID", project: "PRJ-JAK", department: "IT", manager: "Sarah", designation: "Software Engineer", grade: "Staff", costCenter: "CC001", bankDetails: "BCA 1234567890", status: "Active" },
    { id: "EMP002", name: "David", email: "david@expense.com", country: "ID", project: "PRJ-JAK", department: "IT", manager: "Sarah", designation: "UX Designer", grade: "Staff", costCenter: "CC001", bankDetails: "Mandiri 0987654321", status: "Active" },
    { id: "EMP003", name: "Sarah", email: "sarah@expense.com", country: "ID", project: "PRJ-JAK", department: "IT", manager: "Nikita", designation: "Engineering Manager", grade: "Manager", costCenter: "CC001", bankDetails: "BCA 9998887776", status: "Active" },
    { id: "EMP004", name: "Nikita", email: "nikita@expense.com", country: "US", project: "PRJ-USA", department: "IT", manager: "CEO", designation: "Director of IT", grade: "Director", costCenter: "CC001", bankDetails: "Chase 55544433322", status: "Active" },
    { id: "EMP005", name: "Finance User", email: "finance@expense.com", country: "ID", project: "PRJ-JAK", department: "FIN", manager: "Nikita", designation: "Finance Manager", grade: "Senior Staff", costCenter: "CC002", bankDetails: "BCA 1112223334", status: "Active" },
    { id: "EMP006", name: "Auditor User", email: "auditor@expense.com", country: "US", project: "PRJ-USA", department: "FIN", manager: "Nikita", designation: "External Auditor", grade: "Senior Manager", costCenter: "CC002", bankDetails: "Citibank 7776665554", status: "Active" }
  ],
  users: [
    { id: "USR001", employeeId: "EMP001", name: "John", email: "john@expense.com", role: "Employee", password: "employee123", status: "Active" },
    { id: "USR002", employeeId: "EMP002", name: "David", email: "david@expense.com", role: "Employee", password: "employee123", status: "Active" },
    { id: "USR003", employeeId: "EMP003", name: "Sarah", email: "sarah@expense.com", role: "Manager", password: "manager123", status: "Active" },
    { id: "USR004", employeeId: "EMP004", name: "Nikita", email: "nikita@expense.com", role: "Administrator", password: "admin123", status: "Active" },
    { id: "USR005", employeeId: "EMP005", name: "Finance User", email: "finance@expense.com", role: "Finance", password: "finance123", status: "Active" },
    { id: "USR006", employeeId: "EMP006", name: "Auditor User", email: "auditor@expense.com", role: "Auditor", password: "auditor123", status: "Active" }
  ],
  roles: [
    { name: "Administrator", desc: "Full system configuration and master data control", status: "Active" },
    { name: "Manager", desc: "Team expense review, approval, and clarification", status: "Active" },
    { name: "Finance", desc: "Finance verification, payment processing, and disbursements", status: "Active" },
    { name: "Employee", desc: "Submit, track, and edit own expenses and drafts", status: "Active" },
    { name: "Auditor", desc: "Read-only access to all transactions, reports, and logs", status: "Active" }
  ],
  permissions: [
    { role: "Administrator", userSetup: true, addExpense: true, approveExpense: true, financeVerify: true, reports: true, systemSetup: true },
    { role: "Manager", userSetup: false, addExpense: true, approveExpense: true, financeVerify: false, reports: true, systemSetup: false },
    { role: "Finance", userSetup: false, addExpense: true, approveExpense: false, financeVerify: true, reports: true, systemSetup: false },
    { role: "Employee", userSetup: false, addExpense: true, approveExpense: false, financeVerify: false, reports: "Own", systemSetup: false },
    { role: "Auditor", userSetup: false, addExpense: false, approveExpense: false, financeVerify: false, reports: true, systemSetup: false }
  ],
  expenseCategories: [
    { code: "TRA", name: "Travel", icon: "plane", status: "Active" },
    { code: "ACC", name: "Accommodation", icon: "hotel", status: "Active" },
    { code: "FOO", name: "Food", icon: "utensils", status: "Active" },
    { code: "OFF", name: "Office", icon: "desktop", status: "Active" }
  ],
  expenseTypes: [
    { code: "FLI", category: "TRA", name: "Flight", limit: 5000000, currency: "IDR", status: "Active" },
    { code: "TRN", category: "TRA", name: "Train", limit: 1000000, currency: "IDR", status: "Active" },
    { code: "TXI", category: "TRA", name: "Taxi", limit: 500000, currency: "IDR", status: "Active" },
    { code: "CAR", category: "TRA", name: "Car Rental", limit: 1500000, currency: "IDR", status: "Active" },
    { code: "HTL", category: "ACC", name: "Hotel", limit: 1500000, currency: "IDR", status: "Active" },
    { code: "GST", category: "ACC", name: "Guest House", limit: 800000, currency: "IDR", status: "Active" },
    { code: "LNC", category: "FOO", name: "Lunch", limit: 150000, currency: "IDR", status: "Active" },
    { code: "DIN", category: "FOO", name: "Dinner", limit: 200000, currency: "IDR", status: "Active" },
    { code: "CLM", category: "FOO", name: "Client Meal", limit: 500000, currency: "IDR", status: "Active" },
    { code: "STN", category: "OFF", name: "Stationery", limit: 300000, currency: "IDR", status: "Active" },
    { code: "EQP", category: "OFF", name: "Equipment", limit: 5000000, currency: "IDR", status: "Active" },
    { code: "PRN", category: "OFF", name: "Printing", limit: 200000, currency: "IDR", status: "Active" }
  ],
  currencies: [
    { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimalPlaces: 0, status: "Active" },
    { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2, status: "Active" },
    { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, status: "Active" },
    { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2, status: "Active" }
  ],
  paymentMethods: [
    { code: "CSH", name: "Cash", status: "Active" },
    { code: "PCC", name: "Personal Credit Card", status: "Active" },
    { code: "PDC", name: "Personal Debit Card", status: "Active" },
    { code: "CCC", name: "Company Credit Card", status: "Active" },
    { code: "BTF", name: "Bank Transfer", status: "Active" },
    { code: "CAD", name: "Company Advance", status: "Active" }
  ],
  approvalWorkflows: [
    { code: "STD", name: "Standard Expense Workflow", description: "Submit -> Manager Approval -> Finance Verification -> Finance Payout", status: "Active" }
  ],
  approvers: [
    { project: "PRJ-JAK", department: "IT", level: 1, approver: "Sarah" },
    { project: "PRJ-JAK", department: "IT", level: 2, approver: "Finance User" },
    { project: "PRJ-DEL", department: "Sales", level: 1, approver: "Sarah" }
  ],
  expensePolicies: [
    { id: "POL001", type: "Hotel", limit: 1500000, currency: "IDR", scope: "Global", action: "Warning" },
    { id: "POL002", type: "Food", limit: 300000, currency: "IDR", scope: "Daily", action: "Warning" },
    { id: "POL003", type: "Taxi", limit: 500000, currency: "IDR", scope: "Per Trip", action: "Block" },
    { id: "POL004", type: "Flight", limit: 5000000, currency: "IDR", scope: "Per Trip", action: "Warning" }
  ],
  employeeGrades: [
    { name: "Staff", description: "Junior and mid-level contributors" },
    { name: "Senior Staff", description: "Senior engineers and specialist roles" },
    { name: "Manager", description: "Team leads and department managers" },
    { name: "Senior Manager", description: "Directors and function heads" },
    { name: "Director", description: "Executive leadership" }
  ],
  costCenters: [
    { code: "CC001", name: "CC001 - IT", status: "Active" },
    { code: "CC002", name: "CC002 - Finance", status: "Active" },
    { code: "CC003", name: "CC003 - HR", status: "Active" },
    { code: "CC004", name: "CC004 - Operations", status: "Active" }
  ],
  locations: [
    { code: "JAK", name: "Jakarta", country: "ID", status: "Active" },
    { code: "MUM", name: "Mumbai", country: "IN", status: "Active" },
    { code: "DEL", name: "Delhi", country: "IN", status: "Active" },
    { code: "NYC", name: "New York", country: "US", status: "Active" },
    { code: "MUN", name: "Munich", country: "DE", status: "Active" }
  ],
  taxMasters: [
    { code: "VAT11", name: "VAT 11%", rate: 11.0, country: "ID", status: "Active" },
    { code: "GST18", name: "GST 18%", rate: 18.0, country: "IN", status: "Active" },
    { code: "SALES8", name: "Sales Tax 8.875%", rate: 8.875, country: "US", status: "Active" }
  ],
  documentTypes: [
    { name: "Invoice", status: "Active" },
    { name: "Receipt", status: "Active" },
    { name: "Hotel Bill", status: "Active" },
    { name: "Flight Ticket", status: "Active" },
    { name: "Taxi Receipt", status: "Active" },
    { name: "Credit Card Statement", status: "Active" },
    { name: "Other", status: "Active" }
  ],
  expenses: [],
  reports: [],
  reimbursements: [],
  reasons: [
    { code: "MREC", name: "Missing Receipt", type: "Clarification" },
    { code: "EXPO", name: "Amount Exceeds Policy", type: "Rejection" },
    { code: "WCAT", name: "Incorrect Category", type: "Clarification" },
    { code: "WPRJ", name: "Incorrect Project", type: "Clarification" },
    { code: "DUP", name: "Duplicate Expense", type: "Rejection" },
    { code: "INSU", name: "Insufficient Information", type: "Clarification" },
    { code: "PERS", name: "Personal Expense", type: "Rejection" },
    { code: "OTH", name: "Other", type: "Both" }
  ],
  statuses: [
    { code: "DRAFT", label: "Draft" },
    { code: "SUBMITTED", label: "Submitted" },
    { code: "PENDING_MANAGER", label: "Pending Manager Approval" },
    { code: "MANAGER_APPROVED", label: "Manager Approved" },
    { code: "PENDING_FINANCE", label: "Pending Finance Verification" },
    { code: "FINANCE_APPROVED", label: "Finance Approved" },
    { code: "REIMBURSEMENT_PENDING", label: "Reimbursement Pending" },
    { code: "PAID", label: "Paid" },
    { code: "MANAGER_REJECTED", label: "Manager Rejected" },
    { code: "FINANCE_REJECTED", label: "Finance Rejected" },
    { code: "CLARIFICATION_REQUIRED", label: "Clarification Required" },
    { code: "CANCELLED", label: "Cancelled" }
  ],
  auditLogs: []
};

class LocalDatabase {
  constructor() {
    this.key = "EXPENSE_ERP_DATABASE";
    this.init();
  }

  init() {
    const versionKey = "EXPENSE_ERP_V3_EMPTY_DATA";
    if (!localStorage.getItem(versionKey)) {
      localStorage.setItem(this.key, JSON.stringify(DEFAULT_SEEDS));
      localStorage.setItem(versionKey, "true");
      return;
    }

    const cached = localStorage.getItem(this.key);
    if (!cached) {
      localStorage.setItem(this.key, JSON.stringify(DEFAULT_SEEDS));
      return;
    }
  }

  getData() {
    return JSON.parse(localStorage.getItem(this.key));
  }

  saveData(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (error) {
      if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22) {
        console.warn("Storage quota exceeded. Compressing/removing receipt image data URLs to save database...");
        
        if (data.expenses && data.expenses.length > 0) {
          // Find expenses with custom image data URLs
          const expensesWithReceipts = data.expenses.filter(e => e.receiptUrl && e.receiptUrl.startsWith("data:"));
          for (let i = 0; i < expensesWithReceipts.length; i++) {
            expensesWithReceipts[i].receiptUrl = "receipt_attached.png"; // Reset to standard fallback
            try {
              localStorage.setItem(this.key, JSON.stringify(data));
              console.log("Database saved successfully after removing large receipt data.");
              alert("Your browser's local storage is full. The expense was saved, but the receipt image had to be replaced with a placeholder to stay within quota.");
              return;
            } catch (retryError) {
              // continue stripping
            }
          }
        }
        alert("Unable to save data: Browser local storage is completely full. Please clear some space.");
      } else {
        throw error;
      }
    }
  }

  reset() {
    localStorage.setItem(this.key, JSON.stringify(DEFAULT_SEEDS));
    this.addLog("USR004", "Nikita", "Database Reset", "System reset to default seed records.");
  }

  // --- LOGIN VALIDATION ---
  validateLogin(email, password) {
    const users = this.getTable("users");
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === "Active");
    if (user) {
      const emp = this.getTable("employees").find(e => e.id === user.employeeId);
      return { ...user, employeeDetails: emp };
    }
    return null;
  }

  // --- CRUD HELPERS ---
  getTable(table) {
    const data = this.getData();
    return data[table] || [];
  }

  saveTable(table, records) {
    const data = this.getData();
    data[table] = records;
    this.saveData(data);
  }

  addRecord(table, record) {
    const records = this.getTable(table);
    records.push(record);
    this.saveTable(table, records);
  }

  updateRecord(table, matchKey, matchVal, updatedRecord) {
    const records = this.getTable(table);
    const index = records.findIndex(r => r[matchKey] === matchVal);
    if (index !== -1) {
      records[index] = { ...records[index], ...updatedRecord };
      this.saveTable(table, records);
      return true;
    }
    return false;
  }

  deleteRecord(table, matchKey, matchVal) {
    const records = this.getTable(table);
    const filtered = records.filter(r => r[matchKey] !== matchVal);
    this.saveTable(table, filtered);
  }

  // --- AUDIT LOGGER ---
  addLog(userId, userName, action, details) {
    const log = {
      id: "LOG" + Date.now(),
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      details
    };
    this.addRecord("auditLogs", log);
  }
}

// Global Date Range Sanitizer for Folders & Reports
function sanitizeReportDateRange(startDateVal, endDateVal, folderExpenses = []) {
  try {
    if (Array.isArray(folderExpenses) && folderExpenses.length > 0) {
      const validDates = folderExpenses.map(e => e ? e.date : null).filter(Boolean).sort();
      if (validDates.length > 0) {
        return {
          startDate: validDates[0],
          endDate: validDates[validDates.length - 1]
        };
      }
    }
    
    if (startDateVal && endDateVal && startDateVal > endDateVal) {
      return {
        startDate: endDateVal,
        endDate: startDateVal
      };
    }
    
    const today = new Date().toISOString().split("T")[0];
    return {
      startDate: startDateVal || today,
      endDate: endDateVal || today
    };
  } catch (err) {
    const today = new Date().toISOString().split("T")[0];
    return {
      startDate: startDateVal || today,
      endDate: endDateVal || today
    };
  }
}

// Instantiate globally
window.expenseDb = new LocalDatabase();
