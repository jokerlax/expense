// Expense Management System - Database Bridge Layer (MongoDB / Flask Backend API)

class DatabaseBridge {
  constructor() {
    this.key = "EXPENSE_ERP_DATABASE_CACHE";
    this.cache = null;
    this.isReady = false;
    this.readyCallbacks = [];
    this.init();
  }

  init() {
    // Check if initial data was provided by server template
    if (window.__SERVER_DATA__) {
      this.cache = window.__SERVER_DATA__;
      this.isReady = true;
      return;
    }

    // Attempt to load from localStorage cache first for instant synchronous render
    const local = localStorage.getItem(this.key);
    if (local) {
      try {
        this.cache = JSON.parse(local);
      } catch (e) {
        this.cache = {};
      }
    } else {
      this.cache = {};
    }

    // Always fetch fresh truth directly from the Flask & MS SQL Database backend
    this.syncFromBackend();
  }

  async syncFromBackend() {
    try {
      const res = await fetch("/api/all-data");
      if (res.ok) {
        const data = await res.json();
        this.cache = data;
        this.isReady = true;
        localStorage.setItem(this.key, JSON.stringify(data));
        this.readyCallbacks.forEach(cb => cb(this.cache));
        this.readyCallbacks = [];
      }
    } catch (err) {
      console.warn("[DB Bridge] Backend sync notice:", err);
    }
  }

  onReady(callback) {
    if (this.isReady) {
      callback(this.cache);
    } else {
      this.readyCallbacks.push(callback);
    }
  }

  getData() {
    return this.cache || {};
  }

  // --- CRUD HELPERS (Directly communicates with Database) ---
  getTable(table) {
    const data = this.getData();
    return data[table] || [];
  }

  saveTable(table, records) {
    if (!this.cache) this.cache = {};
    this.cache[table] = records;
    localStorage.setItem(this.key, JSON.stringify(this.cache));
  }

  addRecord(table, record) {
    const records = this.getTable(table);
    records.push(record);
    this.saveTable(table, records);

    // Sync to MS SQL Database via Flask Middleware
    fetch(`/api/data/${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    }).catch(e => console.error(`[DB Bridge] Error writing to ${table}:`, e));
  }

  updateRecord(table, matchKey, matchVal, updatedRecord) {
    const records = this.getTable(table);
    const index = records.findIndex(r => r[matchKey] === matchVal);
    if (index !== -1) {
      records[index] = { ...records[index], ...updatedRecord };
      this.saveTable(table, records);

      // Sync to MS SQL Database via Flask Middleware
      fetch(`/api/data/${table}/${encodeURIComponent(matchKey)}/${encodeURIComponent(matchVal)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRecord)
      }).catch(e => console.error(`[DB Bridge] Error updating ${table}:`, e));

      return true;
    }
    return false;
  }

  deleteRecord(table, matchKey, matchVal) {
    const records = this.getTable(table);
    const filtered = records.filter(r => r[matchKey] !== matchVal);
    this.saveTable(table, filtered);

    // Sync to MS SQL Database via Flask Middleware
    fetch(`/api/data/${table}/${encodeURIComponent(matchKey)}/${encodeURIComponent(matchVal)}`, {
      method: "DELETE"
    }).catch(e => console.error(`[DB Bridge] Error deleting from ${table}:`, e));
  }

  async bulkUpsert(table, records) {
    if (!records || records.length === 0) return 0;
    const pk = (table === "employees" || table === "users" || table === "expenses" || table === "reports" || table === "reimbursements" || table === "settlements" || table === "auditLogs" || table === "approvers") ? "id" : (table === "roles" ? "name" : (table === "systemConfig" ? "key" : (table === "permissions" ? "role" : "code")));
    const currentList = this.getTable(table);

    records.forEach(newRec => {
      const idx = currentList.findIndex(r => r[pk] && String(r[pk]).toLowerCase() === String(newRec[pk]).toLowerCase());
      if (idx !== -1) {
        currentList[idx] = { ...currentList[idx], ...newRec };
      } else {
        currentList.push(newRec);
      }
    });

    this.saveTable(table, currentList);

    try {
      const res = await fetch(`/api/data/${table}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(records)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Bulk upsert failed for ${table}`);
      }
      return data.count || records.length;
    } catch (e) {
      console.error(`[DB Bridge] Error bulk writing to ${table}:`, e);
      throw e;
    }
  }

  // --- CLIENT LICENSE & USER CAPACITY SYSTEM ---
  getLicenseStats() {
    const configs = this.getTable("systemConfig") || [];
    const configMap = {};
    configs.forEach(c => {
      if (c && c.key) configMap[c.key] = c.value;
    });

    const maxUsers = parseInt(configMap["MAX_USER_LICENSE"] || "50", 10) || 50;
    const clientName = configMap["CLIENT_NAME"] || "Enterprise Commercial Client";
    const licenseKey = configMap["LICENSE_KEY"] || "EXP-2026-ENT-50U-COMMERCIAL";
    const licenseTier = configMap["LICENSE_TIER"] || `Professional Edition (${maxUsers} Seats)`;
    const licenseExpiry = configMap["LICENSE_EXPIRY"] || "2027-12-31";

    const employees = this.getTable("employees") || [];
    const activeEmployees = employees.filter(e => !e.status || e.status === "Active");
    const activeCount = activeEmployees.length;
    const availableSlots = Math.max(0, maxUsers - activeCount);
    const utilizationPct = maxUsers > 0 ? Math.round((activeCount / maxUsers) * 100) : 0;
    const isLimitReached = activeCount >= maxUsers;

    return {
      maxUsers,
      activeUsers: activeCount,
      availableSlots,
      utilizationPct,
      isLimitReached,
      clientName,
      licenseKey,
      licenseTier,
      licenseExpiry
    };
  }

  async updateLicenseConfig(newConfig) {
    if (!newConfig) return;
    const nowStr = new Date().toISOString().replace("T", " ").slice(0, 19);
    const currentList = this.getTable("systemConfig") || [];

    const keysToUpdate = [
      { key: "MAX_USER_LICENSE", val: newConfig.maxUsers ? String(newConfig.maxUsers) : null },
      { key: "CLIENT_NAME", val: newConfig.clientName || null },
      { key: "LICENSE_KEY", val: newConfig.licenseKey || null },
      { key: "LICENSE_TIER", val: newConfig.licenseTier || null },
      { key: "LICENSE_EXPIRY", val: newConfig.licenseExpiry || null }
    ];

    keysToUpdate.forEach(item => {
      if (item.val !== null) {
        const idx = currentList.findIndex(c => c.key === item.key);
        if (idx !== -1) {
          currentList[idx] = { ...currentList[idx], value: item.val, updatedAt: nowStr };
        } else {
          currentList.push({ key: item.key, value: item.val, description: "License Setting", updatedAt: nowStr });
        }
      }
    });

    this.saveTable("systemConfig", currentList);

    try {
      await fetch("/api/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig)
      });
    } catch (e) {
      console.warn("[DB Bridge] License sync notice:", e);
    }
  }

  // --- LOGIN VALIDATION ---
  validateLogin(email, password) {
    const users = this.getTable("users");
    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === "Active");
    if (user) {
      const emp = this.getTable("employees").find(e => e.id === user.employeeId);
      return { ...user, employeeDetails: emp };
    }
    return null;
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

  // --- RESET DB ---
  async reset() {
    try {
      await fetch("/api/db/reset", { method: "POST" });
      await this.syncFromBackend();
      window.location.reload();
    } catch (e) {
      console.error("[DB Bridge] Reset error:", e);
    }
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
window.expenseDb = new DatabaseBridge();
