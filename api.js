// Expense ERP - API Client communicating with Python Flask Middleware & MongoDB Database

const API = {
  baseUrl: "/api",

  async getStatus() {
    const res = await fetch(`${this.baseUrl}/db/status`);
    return await res.json();
  },

  async login(email, password) {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return await res.json();
  },

  async logout() {
    const res = await fetch(`${this.baseUrl}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    return await res.json();
  },

  async getSession() {
    try {
      const res = await fetch(`${this.baseUrl}/auth/session`);
      if (res.ok) return await res.json();
      return null;
    } catch {
      return null;
    }
  },

  async getAllData() {
    const res = await fetch(`${this.baseUrl}/all-data`);
    return await res.json();
  },

  async getTable(tableName) {
    const res = await fetch(`${this.baseUrl}/data/${tableName}`);
    return await res.json();
  },

  async addRecord(tableName, record) {
    const res = await fetch(`${this.baseUrl}/data/${tableName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record)
    });
    return await res.json();
  },

  async updateRecord(tableName, matchKey, matchVal, updatedRecord) {
    const res = await fetch(`${this.baseUrl}/data/${tableName}/${encodeURIComponent(matchKey)}/${encodeURIComponent(matchVal)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedRecord)
    });
    return await res.json();
  },

  async deleteRecord(tableName, matchKey, matchVal) {
    const res = await fetch(`${this.baseUrl}/data/${tableName}/${encodeURIComponent(matchKey)}/${encodeURIComponent(matchVal)}`, {
      method: "DELETE"
    });
    return await res.json();
  },

  async addLog(userId, userName, action, details) {
    const res = await fetch(`${this.baseUrl}/audit-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, userName, action, details })
    });
    return await res.json();
  },

  async resetDb() {
    const res = await fetch(`${this.baseUrl}/db/reset`, {
      method: "POST"
    });
    return await res.json();
  }
};

window.API = API;

// ==============================================================================
// GLOBAL MOBILE RESPONSIVE SIDEBAR CONTROLLER
// ==============================================================================
function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function openSidebar() {
  document.body.classList.add("sidebar-open");
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.openSidebar = openSidebar;

document.addEventListener("DOMContentLoaded", () => {
  // Close sidebar when clicking backdrop
  const backdrop = document.getElementById("sidebar-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }

  // Close sidebar on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  // Close sidebar when clicking any navigation link on mobile screens
  document.querySelectorAll(".sidebar .menu-item").forEach(item => {
    item.addEventListener("click", () => {
      if (window.innerWidth <= 992) {
        closeSidebar();
      }
    });
  });
});

