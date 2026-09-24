// Admin & Auditor Dashboard Controller Logic

// Get current session
const sessionData = sessionStorage.getItem("EXPENSE_SESSION");
const currentUser = JSON.parse(sessionData);

let activeTab = "dashboard";
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  initAdminPortal();
});

function initAdminPortal() {
  // Update header labels
  document.getElementById("user-display-name").innerText = currentUser.name;
  document.getElementById("user-display-role").innerText = currentUser.role;
  document.getElementById("user-display-avatar").innerText = currentUser.name.charAt(0);
  document.getElementById("page-subtitle").innerText = `Welcome back, ${currentUser.name}`;

  // Set up click handlers for sidebar menu
  document.querySelectorAll(".menu-item[data-view]").forEach(item => {
    item.addEventListener("click", (e) => {
      const view = e.currentTarget.getAttribute("data-view");
      navigateToTab(view);
    });
  });

  // Auditor Role Restrictions: Lock edit/write buttons
  if (currentUser.role === "Auditor") {
    const addEmpBtn = document.getElementById("btn-add-employee");
    const addPolBtn = document.getElementById("btn-add-policy");
    const resetDbBtn = document.getElementById("btn-reset-db");
    
    if (addEmpBtn) { addEmpBtn.disabled = true; addEmpBtn.style.opacity = "0.5"; addEmpBtn.title = "Auditor access: Read-only"; }
    if (addPolBtn) { addPolBtn.disabled = true; addPolBtn.style.opacity = "0.5"; addPolBtn.title = "Auditor access: Read-only"; }
    if (resetDbBtn) { resetDbBtn.disabled = true; resetDbBtn.style.opacity = "0.5"; resetDbBtn.title = "Auditor access: Read-only"; }
    
    document.querySelectorAll(".btn-m-add").forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.title = "Auditor access: Read-only";
    });
    
    showToast("Logged in as Auditor: Read-only access enabled.", "success");
  }

  refreshUI();
  
  // Trigger bar animations
  setTimeout(() => {
    document.querySelectorAll(".progress-bar-fill").forEach(bar => {
      const w = bar.style.width;
      bar.style.width = "0%";
      setTimeout(() => { bar.style.width = w; }, 100);
    });
  }, 300);
}

function navigateToTab(tabName) {
  activeTab = tabName;
  
  // Toggle sidebar items
  document.querySelectorAll(".menu-item[data-view]").forEach(item => {
    if (item.getAttribute("data-view") === tabName) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Toggle active view panel
  const sections = ["dashboard", "reports", "employees", "settings", "masters", "my-expenses", "add-expense", "approvals", "reimbursement", "settlements"];
  sections.forEach(s => {
    const panel = document.getElementById(`view-${s}`);
    if (panel) {
      if (s === tabName) {
        panel.style.display = "block";
      } else {
        panel.style.display = "none";
      }
    }
  });

  // Update header title based on tab
  const titles = {
    "dashboard": "Dashboard Overview",
    "reports": "Analytical Dashboards",
    "employees": "Personnel & Permissions",
    "settings": "Configurations & Setup",
    "masters": "Core Master Setup",
    "my-expenses": "Corporate Transactions Ledger",
    "add-expense": "Log New Expense",
    "approvals": "Corporate Approvals Queue",
    "reimbursement": "Reimbursement Payments Tracking",
    "settlements": "Enterprise Settlement Desk"
  };
  document.getElementById("page-title").innerText = titles[tabName] || "ERP Dashboard";
  
  if (tabName === "dashboard") {
    refreshUI();
  } else if (tabName === "reports") {
    renderReportsViewCharts();
  } else if (tabName === "employees") {
    renderEmployeesTables();
  } else if (tabName === "settings") {
    renderSettingsTab();
  } else if (tabName === "masters") {
    renderMastersView();
  } else if (tabName === "my-expenses") {
    renderAdminLedger();
  } else if (tabName === "add-expense") {
    setupAdminExpenseForm();
  } else if (tabName === "approvals") {
    renderAdminApprovals();
  } else if (tabName === "reimbursement") {
    renderAdminReimbursements();
  } else if (tabName === "settlements") {
    initAdminSettlementsPage();
  }
}

function refreshUI() {
  refreshKPIs();
  renderRecentExpenses();
  renderCharts();
}

// ================= MULTI-CURRENCY & COUNTRY CONTEXT =================

const EXCHANGE_RATES = {
  IDR: 1.0,
  INR: 175.0, // 1 INR = 175 IDR
  USD: 15000.0, // 1 USD = 15000 IDR
  EUR: 16500.0, // 1 EUR = 16500 IDR
  SGD: 11500.0, // 1 SGD = 11500 IDR
  GBP: 19500.0  // 1 GBP = 19500 IDR
};

function getUserCountry() {
  if (!currentUser) return "US";
  if (currentUser.country) return currentUser.country;
  
  // Look up employee record by employeeId, id, or email
  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => 
    (currentUser.employeeId && e.id === currentUser.employeeId) ||
    (currentUser.id && e.id === currentUser.id) ||
    (currentUser.email && e.email === currentUser.email) ||
    (currentUser.name && e.name === currentUser.name)
  );
  if (emp && emp.country) return emp.country;
  return "US";
}

function getCurrencyForCountry(countryCodeOrName) {
  if (!countryCodeOrName) countryCodeOrName = getUserCountry();
  const countries = expenseDb.getTable("countries") || [];
  const countryObj = countries.find(c => 
    (c.code && c.code.toUpperCase() === countryCodeOrName.toUpperCase()) ||
    (c.name && c.name.toLowerCase() === countryCodeOrName.toLowerCase())
  );
  if (countryObj && countryObj.currency) return countryObj.currency;
  if (countryCodeOrName.length === 3) return countryCodeOrName.toUpperCase();
  
  const map = { "US": "USD", "ID": "IDR", "IN": "INR", "DE": "EUR", "SG": "SGD", "GB": "GBP", "UK": "GBP" };
  return map[countryCodeOrName.toUpperCase()] || "USD";
}

function getUserCurrency() {
  return getCurrencyForCountry(getUserCountry());
}

function getCurrencyDetails(currencyOrCountry) {
  let currCode = currencyOrCountry;
  if (!currCode) currCode = getUserCurrency();
  if (currCode.length === 2) currCode = getCurrencyForCountry(currCode);
  
  const currencies = expenseDb.getTable("currencies") || [];
  const currObj = currencies.find(c => c.code.toUpperCase() === currCode.toUpperCase());
  if (currObj) {
    return {
      code: currObj.code,
      symbol: currObj.symbol || (currObj.code === 'USD' ? '$' : currObj.code === 'EUR' ? '€' : currObj.code === 'INR' ? '₹' : currObj.code === 'SGD' ? 'S$' : 'Rp'),
      decimals: currObj.decimalPlaces !== undefined ? currObj.decimalPlaces : (currObj.code === 'IDR' ? 0 : 2)
    };
  }
  
  const defaults = {
    USD: { code: "USD", symbol: "$", decimals: 2 },
    IDR: { code: "IDR", symbol: "Rp", decimals: 0 },
    INR: { code: "INR", symbol: "₹", decimals: 2 },
    EUR: { code: "EUR", symbol: "€", decimals: 2 },
    SGD: { code: "SGD", symbol: "S$", decimals: 2 },
    GBP: { code: "GBP", symbol: "£", decimals: 2 }
  };
  return defaults[currCode.toUpperCase()] || { code: currCode, symbol: currCode + " ", decimals: 2 };
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const from = fromCurrency || "IDR";
  const to = toCurrency || "IDR";
  if (from === to) return amount;
  const fromRate = EXCHANGE_RATES[from] || 1.0;
  const toRate = EXCHANGE_RATES[to] || 1.0;
  const amountInBase = amount * fromRate;
  return amountInBase / toRate;
}

function formatAmount(amount, currencyOrCountry = null) {
  if (amount === undefined || amount === null || isNaN(amount)) amount = 0;
  const details = getCurrencyDetails(currencyOrCountry || getUserCurrency());
  
  let formattedNumber;
  if (details.code === "IDR") {
    formattedNumber = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: details.decimals,
      maximumFractionDigits: details.decimals
    }).format(amount);
  } else {
    formattedNumber = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: details.decimals,
      maximumFractionDigits: details.decimals
    }).format(amount);
  }
  return `${details.symbol} ${formattedNumber}`.trim();
}

function formatIDR(value, countryOrCurrency = null) {
  return formatAmount(value, countryOrCurrency);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function initDashboardCountrySelector() {
  const sel = document.getElementById("dashboard-country-select");
  if (!sel || sel.options.length > 0) return;

  const userCountry = getUserCountry();
  const userCurr = getUserCurrency();
  const currDetails = getCurrencyDetails(userCurr);

  sel.innerHTML = `<option value="AUTO" selected>My Assigned Country: ${userCountry} (${currDetails.code} - ${currDetails.symbol})</option>`;
  
  const countries = expenseDb.getTable("countries") || [];
  countries.forEach(c => {
    const cCurr = getCurrencyDetails(c.currency);
    sel.innerHTML += `<option value="${c.code}">${c.name} (${cCurr.code} - ${cCurr.symbol})</option>`;
  });
}

function getActiveDashboardCurrency() {
  const sel = document.getElementById("dashboard-country-select");
  const selected = sel ? sel.value : "AUTO";
  if (selected === "AUTO" || !selected) {
    return getUserCurrency();
  }
  return getCurrencyForCountry(selected);
}

// Refresh KPI values
function refreshKPIs() {
  initDashboardCountrySelector();

  const activeCurr = getActiveDashboardCurrency();
  const currDetails = getCurrencyDetails(activeCurr);
  const userCountry = getUserCountry();

  const badge = document.getElementById("dashboard-active-currency-badge");
  if (badge) {
    const countries = expenseDb.getTable("countries") || [];
    const sel = document.getElementById("dashboard-country-select");
    const selectedVal = sel ? sel.value : "AUTO";
    const countryCode = selectedVal === "AUTO" ? userCountry : selectedVal;
    const countryObj = countries.find(c => c.code === countryCode);
    const countryName = countryObj ? countryObj.name : countryCode;
    badge.innerText = `${countryName} (${currDetails.code} - ${currDetails.symbol})`;
  }

  const expenses = expenseDb.getTable("expenses");
  
  let approvedSum = 0;
  let pendingSum = 0;
  let rejectedSum = 0;
  
  expenses.forEach(e => {
    const fromCurr = e.currency || "IDR";
    const convertedAmount = convertCurrency(e.amount, fromCurr, activeCurr);

    if (e.status === "APPROVED" || e.status === "FINANCE_APPROVED" || e.status === "PAID" || e.status === "REIMBURSEMENT_PENDING") {
      approvedSum += convertedAmount;
    } else if (e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "PENDING_FINANCE") {
      pendingSum += convertedAmount;
    } else if (e.status === "MANAGER_REJECTED" || e.status === "FINANCE_REJECTED") {
      rejectedSum += convertedAmount;
    }
  });

  const totalSum = approvedSum + pendingSum + rejectedSum;

  document.getElementById("kpi-total").innerText = formatAmount(totalSum, activeCurr);
  document.getElementById("kpi-approved").innerText = formatAmount(approvedSum, activeCurr);
  document.getElementById("kpi-pending").innerText = formatAmount(pendingSum, activeCurr);
  document.getElementById("kpi-rejected").innerText = formatAmount(rejectedSum, activeCurr);
}

// Render Recent Expenses table on main dashboard
function renderRecentExpenses() {
  const expenses = expenseDb.getTable("expenses");
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const activeCurr = getActiveDashboardCurrency();
  
  const container = document.getElementById("dashboard-recent-expenses");
  if (!container) return;
  container.innerHTML = "";

  if (sorted.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No recent expenses logged.</td></tr>`;
    return;
  }

  sorted.forEach(e => {
    const row = document.createElement("tr");
    const expCurrency = e.currency || activeCurr;
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${e.employeeName}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600;">${formatAmount(e.amount, expCurrency)}</td>
      <td>${formatDate(e.date)}</td>
      <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
    `;
    container.appendChild(row);
  });
}

// ================= CHART RENDERING =================

function renderCharts() {
  const expenses = expenseDb.getTable("expenses");
  const activeCurr = getActiveDashboardCurrency();
  const currDetails = getCurrencyDetails(activeCurr);
  
  // 1. Monthly chart
  const selectedYear = document.getElementById("dashboard-year-select") ? (document.getElementById("dashboard-year-select").value || "2026") : "2026";
  const monthlyData = Array(6).fill(0);
  
  expenses.forEach(e => {
    const expDate = new Date(e.date);
    if (expDate.getFullYear().toString() === selectedYear) {
      const month = expDate.getMonth();
      if (month >= 0 && month <= 5 && e.status !== "DRAFT") {
        const fromCurr = e.currency || "IDR";
        const converted = convertCurrency(e.amount, fromCurr, activeCurr);
        monthlyData[month] += converted;
      }
    }
  });

  const chartEl = document.getElementById("chart-monthly");
  if (!chartEl) return;
  const ctxMonthly = chartEl.getContext("2d");
  
  if (charts["monthly"]) charts["monthly"].destroy();
  charts["monthly"] = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Monthly Expenses',
        data: monthlyData,
        backgroundColor: '#4f46e5',
        borderRadius: 6,
        barThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return formatAmount(context.raw, activeCurr);
            }
          }
        }
      },
      scales: {
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: value => {
              if (currDetails.code === "IDR") return `${currDetails.symbol} ` + (value / 1000000) + 'M';
              return `${currDetails.symbol} ` + (value >= 1000 ? (value / 1000) + 'k' : value);
            },
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          },
          border: { display: false }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 10 } },
          border: { display: false }
        }
      }
    }
  });

  // 2. Categories breakdown progress list
  const catSums = {};
  let totalSum = 0;
  
  expenses.forEach(e => {
    if (e.status !== "DRAFT") {
      catSums[e.category] = (catSums[e.category] || 0) + e.amount;
      totalSum += e.amount;
    }
  });

  const progressContainer = document.getElementById("category-progress-container");
  progressContainer.innerHTML = "";

  const categories = expenseDb.getTable("expenseCategories");
  
  categories.forEach(cat => {
    const sum = catSums[cat.name] || 0;
    const percentage = totalSum > 0 ? Math.round((sum / totalSum) * 100) : 0;
    
    const item = document.createElement("div");
    item.className = "progress-item";
    item.innerHTML = `
      <div class="progress-label-row">
        <span class="progress-label"><i class="fa-solid fa-${cat.icon}"></i> ${cat.name}</span>
        <span class="progress-percentage">${percentage}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${percentage}%"></div>
      </div>
    `;
    progressContainer.appendChild(item);
  });
}

// In-depth analytical reports view
function renderReportsViewCharts(expenses = null) {
  if (!expenses) {
    expenses = expenseDb.getTable("expenses").filter(e => e.status !== "DRAFT");
    populateReportFilterDropdowns();
  }
  
  // Country chart
  const countrySums = {};
  expenses.forEach(e => { countrySums[e.country] = (countrySums[e.country] || 0) + e.amount; });
  const countryCtx = document.getElementById("chart-country").getContext("2d");
  if (charts["country"]) charts["country"].destroy();
  charts["country"] = new Chart(countryCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(countrySums),
      datasets: [{
        data: Object.values(countrySums),
        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Project chart
  const projectSums = {};
  expenses.forEach(e => { projectSums[e.project] = (projectSums[e.project] || 0) + e.amount; });
  const projectCtx = document.getElementById("chart-project").getContext("2d");
  if (charts["project"]) charts["project"].destroy();
  charts["project"] = new Chart(projectCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(projectSums),
      datasets: [{
        label: 'Expenses',
        data: Object.values(projectSums),
        backgroundColor: '#10b981',
        borderRadius: 4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
  });

  // Department chart
  const deptSums = {};
  expenses.forEach(e => { deptSums[e.department] = (deptSums[e.department] || 0) + e.amount; });
  const deptCtx = document.getElementById("chart-department").getContext("2d");
  if (charts["department"]) charts["department"].destroy();
  charts["department"] = new Chart(deptCtx, {
    type: 'bar',
    data: {
      labels: Object.keys(deptSums),
      datasets: [{
        label: 'Expenses',
        data: Object.values(deptSums),
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  // Employee chart
  const empSums = {};
  expenses.forEach(e => { empSums[e.employeeName] = (empSums[e.employeeName] || 0) + e.amount; });
  const empCtx = document.getElementById("chart-employee").getContext("2d");
  if (charts["employee"]) charts["employee"].destroy();
  charts["employee"] = new Chart(empCtx, {
    type: 'polarArea',
    data: {
      labels: Object.keys(empSums),
      datasets: [{
        data: Object.values(empSums),
        backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

// ================= PERSONNEL ROSTER & PERMISSIONS =================

function renderEmployeesTables() {
  const emps = expenseDb.getTable("employees");
  const users = expenseDb.getTable("users");
  const rosterBody = document.getElementById("admin-employee-table-body");
  if (!rosterBody) return;
  rosterBody.innerHTML = "";
  
  if (emps.length === 0) {
    rosterBody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:var(--text-muted);">No employees registered.</td></tr>`;
  }

  emps.forEach(e => {
    const user = users.find(u => u.employeeId === e.id || (u.email && e.email && u.email.toLowerCase() === e.email.toLowerCase()));
    const assignedRole = user ? user.role : "Employee";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${e.id}</strong></td>
      <td><span style="font-weight: 600; color: var(--text-dark);">${e.name}</span></td>
      <td>${e.email}</td>
      <td>${e.country}</td>
      <td>${e.department}</td>
      <td>${e.manager}</td>
      <td>${e.grade}</td>
      <td><code>${e.costCenter}</code></td>
      <td><span class="status-badge" style="background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;">${assignedRole}</span></td>
      <td><span class="status-badge ${e.status === 'Active' ? 'approved' : 'draft'}">${e.status}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="editEmployee('${e.id}')" title="Edit Employee & Assign Role"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${e.id}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''} title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    rosterBody.appendChild(row);
  });

  // Render Roles Table in Roles Tab
  renderRolesTable();

  // Update License Capacity Badge in Active Personnel Registry Header
  const licenseBadge = document.getElementById("emp-license-badge");
  if (licenseBadge && expenseDb.getLicenseStats) {
    const stats = expenseDb.getLicenseStats();
    licenseBadge.innerHTML = `<i class="fa-solid fa-id-badge"></i> License: ${stats.activeUsers} / ${stats.maxUsers} Seats (${stats.utilizationPct}%)`;
    if (stats.isLimitReached) {
      licenseBadge.className = "status-badge rejected";
      licenseBadge.style.backgroundColor = "#fef2f2";
      licenseBadge.style.color = "#991b1b";
      licenseBadge.style.border = "1px solid #fecaca";
      licenseBadge.title = "Client user license limit reached! Increase capacity in Settings -> System & Database Setup.";
    } else if (stats.utilizationPct >= 80) {
      licenseBadge.className = "status-badge pending";
      licenseBadge.style.backgroundColor = "#fffbeb";
      licenseBadge.style.color = "#92400e";
      licenseBadge.style.border = "1px solid #fde68a";
      licenseBadge.title = `${stats.availableSlots} license seats available.`;
    } else {
      licenseBadge.className = "status-badge approved";
      licenseBadge.style.backgroundColor = "#f0fdf4";
      licenseBadge.style.color = "#166534";
      licenseBadge.style.border = "1px solid #bbf7d0";
      licenseBadge.title = `${stats.availableSlots} license seats available.`;
    }
  }

  // Permissions matrix
  const perms = expenseDb.getTable("permissions");
  const permBody = document.getElementById("admin-permissions-table-body");
  if (permBody) {
    permBody.innerHTML = "";
    const isAuditor = currentUser.role === 'Auditor';

    perms.forEach(p => {
      const isAllReports = p.reports === 'All' || p.reports === '1' || p.reports === 1 || p.reports === true;
      const isOwnReports = p.reports === 'Own';

      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight: 700; color: var(--primary);">${p.role}</td>
        <td style="text-align: center;">
          <label class="erp-checkbox-label" title="Toggle User Setup for ${p.role}">
            <input type="checkbox" ${p.userSetup ? 'checked' : ''} onchange="updateRolePermission('${p.role}', 'userSetup', this.checked ? 1 : 0)" ${isAuditor ? 'disabled' : ''}>
          </label>
        </td>
        <td style="text-align: center;">
          <label class="erp-checkbox-label" title="Toggle Add Expense for ${p.role}">
            <input type="checkbox" ${p.addExpense ? 'checked' : ''} onchange="updateRolePermission('${p.role}', 'addExpense', this.checked ? 1 : 0)" ${isAuditor ? 'disabled' : ''}>
          </label>
        </td>
        <td style="text-align: center;">
          <label class="erp-checkbox-label" title="Toggle Approve Expense for ${p.role}">
            <input type="checkbox" ${p.approveExpense ? 'checked' : ''} onchange="updateRolePermission('${p.role}', 'approveExpense', this.checked ? 1 : 0)" ${isAuditor ? 'disabled' : ''}>
          </label>
        </td>
        <td style="text-align: center;">
          <label class="erp-checkbox-label" title="Toggle Finance Verify for ${p.role}">
            <input type="checkbox" ${p.financeVerify ? 'checked' : ''} onchange="updateRolePermission('${p.role}', 'financeVerify', this.checked ? 1 : 0)" ${isAuditor ? 'disabled' : ''}>
          </label>
        </td>
        <td style="text-align: center;">
          <select class="erp-perm-select" onchange="updateRolePermission('${p.role}', 'reports', this.value)" ${isAuditor ? 'disabled' : ''}>
            <option value="All" ${isAllReports ? 'selected' : ''}>All Reports</option>
            <option value="Own" ${isOwnReports ? 'selected' : ''}>Own Only</option>
            <option value="None" ${(!isAllReports && !isOwnReports) ? 'selected' : ''}>None</option>
          </select>
        </td>
        <td style="text-align: center;">
          <label class="erp-checkbox-label" title="Toggle System Setup for ${p.role}">
            <input type="checkbox" ${p.systemSetup ? 'checked' : ''} onchange="updateRolePermission('${p.role}', 'systemSetup', this.checked ? 1 : 0)" ${isAuditor ? 'disabled' : ''}>
          </label>
        </td>
      `;
      permBody.appendChild(row);
    });
  }
}

// ================= ROLES MANAGEMENT =================

function renderRolesTable() {
  const roles = expenseDb.getTable("roles");
  const users = expenseDb.getTable("users");
  const perms = expenseDb.getTable("permissions");
  const rolesBody = document.getElementById("admin-roles-table-body");
  if (!rolesBody) return;
  rolesBody.innerHTML = "";

  if (roles.length === 0) {
    rolesBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted); padding:16px;">No security roles found.</td></tr>`;
    return;
  }

  roles.forEach(r => {
    const assignedUsers = users.filter(u => u.role && u.role.toLowerCase() === r.name.toLowerCase());
    const count = assignedUsers.length;
    const names = assignedUsers.map(u => u.name).slice(0, 3).join(", ") + (count > 3 ? ` +${count - 3} more` : "");
    const perm = perms.find(p => p.role && p.role.toLowerCase() === r.name.toLowerCase());
    
    const caps = [];
    if (perm) {
      if (perm.userSetup) caps.push("User Setup");
      if (perm.addExpense) caps.push("Add Expense");
      if (perm.approveExpense) caps.push("Approvals");
      if (perm.financeVerify) caps.push("Finance Verify");
      if (perm.reports && perm.reports !== "None" && perm.reports !== "0") caps.push(`Reports (${perm.reports})`);
      if (perm.systemSetup) caps.push("System Setup");
    }
    const capSummary = caps.length > 0 ? caps.join(", ") : "Standard Access";
    const isSystemRole = ["Administrator", "Manager", "Finance", "Employee", "Auditor"].includes(r.name);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <span class="status-badge" style="background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-weight:700;">
          <i class="fa-solid fa-shield-halved" style="font-size: 9.5px; margin-right: 4px;"></i> ${r.name}
        </span>
      </td>
      <td>
        <div style="font-weight: 500; color: var(--text-dark);">${r.desc || r.description || "System security role"}</div>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 1px;">Capabilities: ${capSummary}</div>
      </td>
      <td>
        <span class="status-badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;" title="${names || 'No users assigned'}">
          <i class="fa-solid fa-users" style="font-size: 9.5px; margin-right: 4px;"></i> ${count} Personnel
        </span>
      </td>
      <td>
        <span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status || 'Active'}</span>
      </td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="editRole('${r.name}')" title="Edit Role Details"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRole('${r.name}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : ''} title="Delete Role"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    rolesBody.appendChild(row);
  });
}

function openRoleModal(roleName = null) {
  if (currentUser.role === "Auditor") {
    showToast("Auditors have read-only access.", "error");
    return;
  }
  const modal = document.getElementById("modal-role");
  if (!modal) return;
  
  const title = document.getElementById("title-modal-role");
  const modeInput = document.getElementById("role-mode");
  const origNameInput = document.getElementById("role-original-name");
  const nameInput = document.getElementById("role-name-input");
  const descInput = document.getElementById("role-desc-input");
  const statusSelect = document.getElementById("role-status-select");

  if (roleName) {
    const role = expenseDb.getTable("roles").find(r => r.name.toLowerCase() === roleName.toLowerCase());
    if (!role) return;
    title.innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: var(--primary);"></i> Edit Role: ${role.name}`;
    modeInput.value = "edit";
    origNameInput.value = role.name;
    nameInput.value = role.name;
    nameInput.disabled = false;
    descInput.value = role.desc || role.description || "";
    statusSelect.value = role.status || "Active";
  } else {
    title.innerHTML = `<i class="fa-solid fa-shield-halved" style="color: var(--primary);"></i> Add Security Role`;
    modeInput.value = "add";
    origNameInput.value = "";
    nameInput.value = "";
    nameInput.disabled = false;
    descInput.value = "";
    statusSelect.value = "Active";
  }

  modal.classList.add("active");
}

function closeRoleModal() {
  const modal = document.getElementById("modal-role");
  if (modal) modal.classList.remove("active");
}

function editRole(roleName) {
  openRoleModal(roleName);
}

function deleteRole(roleName) {
  if (currentUser.role === "Auditor") {
    showToast("Auditors have read-only access.", "error");
    return;
  }
  
  const users = expenseDb.getTable("users").filter(u => u.role && u.role.toLowerCase() === roleName.toLowerCase());
  
  if (users.length > 0) {
    const confirmReassign = confirm(`Role '${roleName}' is currently assigned to ${users.length} active employee(s).\n\nDeleting this role will automatically reassign these personnel to 'Employee'.\n\nDo you want to proceed with deleting this role?`);
    if (!confirmReassign) return;
    
    // Automatically reassign assigned users to default 'Employee' role
    users.forEach(u => {
      expenseDb.updateRecord("users", "id", u.id, { role: "Employee" });
    });
  } else {
    if (!confirm(`Are you sure you want to delete role '${roleName}'?`)) return;
  }

  expenseDb.deleteRecord("roles", "name", roleName);
  expenseDb.deleteRecord("permissions", "role", roleName);
  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    "Delete Role",
    `Deleted security role [${roleName}] and sanitized user permissions.`
  );
  showToast(`Security role '${roleName}' deleted successfully.`, "success");
  renderRolesTable();
  renderEmployeesTables();
}

function handleSaveRole(e) {
  e.preventDefault();
  if (currentUser.role === "Auditor") return;

  const mode = document.getElementById("role-mode").value;
  const origName = document.getElementById("role-original-name").value;
  const name = document.getElementById("role-name-input").value.trim();
  const desc = document.getElementById("role-desc-input").value.trim();
  const status = document.getElementById("role-status-select").value;

  if (!name) {
    alert("Role Name is required.");
    return;
  }

  const roles = expenseDb.getTable("roles");
  if (mode === "add") {
    const exists = roles.some(r => r.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      alert(`A role with name '${name}' already exists.`);
      return;
    }
    const newRole = { name, desc, status };
    expenseDb.addRecord("roles", newRole);
    
    // Add default permission entry if not exists
    const perms = expenseDb.getTable("permissions");
    if (!perms.some(p => p.role.toLowerCase() === name.toLowerCase())) {
      expenseDb.addRecord("permissions", {
        role: name,
        userSetup: 0,
        addExpense: 1,
        approveExpense: 0,
        financeVerify: 0,
        reports: "Own",
        systemSetup: 0
      });
    }
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Add Role", `Created new security role [${name}]`);
    showToast(`Role '${name}' created successfully.`, "success");
  } else {
    // Edit
    const updated = { name: origName, desc, status };
    expenseDb.updateRecord("roles", "name", origName, updated);
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Update Role", `Updated security role [${origName}]`);
    showToast(`Role '${origName}' updated.`, "success");
  }

  closeRoleModal();
  renderRolesTable();
  renderEmployeesTables();
}

// ================= ACTIVE PERSONNEL REGISTRY EXCEL TEMPLATE & BULK IMPORT =================

function downloadPersonnelTemplate() {
  const sampleData = [
    {
      "EMP ID": "EMP007",
      "Name": "Alex Morgan",
      "Email": "alex.morgan@expense.com",
      "Password": "password123",
      "Country": "US",
      "Department": "IT",
      "Manager": "Nikita",
      "Grade": "Staff",
      "Cost Center": "CC001",
      "Assigned Role": "Employee",
      "Project": "PRJ-USA",
      "Bank Details": "Chase 1122334455",
      "Status": "Active"
    },
    {
      "EMP ID": "EMP008",
      "Name": "Maria Chen",
      "Email": "maria.chen@expense.com",
      "Password": "password123",
      "Country": "ID",
      "Department": "FIN",
      "Manager": "Finance User",
      "Grade": "Senior Staff",
      "Cost Center": "CC002",
      "Assigned Role": "Finance",
      "Project": "PRJ-JAK",
      "Bank Details": "BCA 8899001122",
      "Status": "Active"
    },
    {
      "EMP ID": "EMP009",
      "Name": "Robert Taylor",
      "Email": "robert.taylor@expense.com",
      "Password": "password123",
      "Country": "DE",
      "Department": "OPS",
      "Manager": "Nikita",
      "Grade": "Manager",
      "Cost Center": "CC004",
      "Assigned Role": "Manager",
      "Project": "PRJ-MUN",
      "Bank Details": "Deutsche Bank 55667788",
      "Status": "Active"
    }
  ];

  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const colWidths = [
      { wch: 10 },
      { wch: 18 },
      { wch: 26 },
      { wch: 16 },
      { wch: 10 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 22 },
      { wch: 10 }
    ];
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personnel_Registry");
    XLSX.writeFile(wb, "Personnel_Registry_Template.xlsx");
    showToast("Downloaded Personnel_Registry_Template.xlsx", "success");
  } else {
    const headers = Object.keys(sampleData[0]).join(",");
    const rows = sampleData.map(r => Object.values(r).map(v => `"${v}"`).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + "\n" + rows);
    const a = document.createElement("a");
    a.href = csvContent;
    a.download = "Personnel_Registry_Template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Downloaded Personnel_Registry_Template.csv", "success");
  }
}

function exportPersonnelExcel() {
  const emps = expenseDb.getTable("employees");
  const users = expenseDb.getTable("users");
  
  const exportRows = emps.map(e => {
    const user = users.find(u => u.employeeId === e.id || (u.email && e.email && u.email.toLowerCase() === e.email.toLowerCase()));
    return {
      "EMP ID": e.id,
      "Name": e.name,
      "Email": e.email,
      "Password": user ? user.password : "employee123",
      "Country": e.country,
      "Department": e.department,
      "Manager": e.manager,
      "Grade": e.grade,
      "Cost Center": e.costCenter,
      "Assigned Role": user ? user.role : "Employee",
      "Project": e.project || "",
      "Bank Details": e.bankDetails || "",
      "Status": e.status
    };
  });

  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Active_Personnel");
    XLSX.writeFile(wb, `Active_Personnel_Registry_${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("Exported Active_Personnel_Registry.xlsx", "success");
  } else {
    exportData("csv");
  }
}

function exportPersonnelPDF() {
  const emps = expenseDb.getTable("employees");
  const users = expenseDb.getTable("users");
  const today = new Date().toISOString().split("T")[0];
  
  const headers = ["EMP ID", "Name", "Email", "Country", "Dept", "Manager", "Grade", "Cost Center", "Role", "Status"];
  const rows = emps.map(e => {
    const user = users.find(u => u.employeeId === e.id || (u.email && e.email && u.email.toLowerCase() === e.email.toLowerCase()));
    return [
      e.id || "",
      e.name || "",
      e.email || "",
      e.country || "",
      e.department || "",
      e.manager || "",
      e.grade || "",
      e.costCenter || "",
      user ? user.role : "Employee",
      e.status || "Active"
    ];
  });

  if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape" });
    
    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("EXPENSE ERP - Active Personnel Registry", 14, 13);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${today} | Total Records: ${emps.length}`, doc.internal.pageSize.getWidth() - 14, 13, { align: "right" });

    doc.autoTable({
      startY: 26,
      head: [headers],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 26, left: 10, right: 10, bottom: 10 }
    });

    doc.save(`Active_Personnel_Registry_${today}.pdf`);
    showToast("Exported Active Personnel Registry as PDF.", "success");
  } else {
    printTableDirectly("Active Personnel Registry", headers, rows);
    showToast("Opening printable PDF preview...", "success");
  }

  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Data Export", "Exported Active Personnel Registry in PDF format.");
}

let parsedPersonnelData = [];

function openPersonnelImportModal() {
  if (currentUser.role === "Auditor") {
    showToast("Auditors have read-only access.", "error");
    return;
  }
  parsedPersonnelData = [];
  const modal = document.getElementById("modal-personnel-import");
  if (!modal) return;

  const fileInput = document.getElementById("personnel-file-input");
  if (fileInput) fileInput.value = "";
  document.getElementById("personnel-file-info").style.display = "none";
  document.getElementById("personnel-preview-section").style.display = "none";
  document.getElementById("personnel-error-alert").style.display = "none";
  document.getElementById("btn-confirm-personnel-import").disabled = true;

  modal.classList.add("active");
}

function closePersonnelImportModal() {
  const modal = document.getElementById("modal-personnel-import");
  if (modal) modal.classList.remove("active");
  parsedPersonnelData = [];
}

function handlePersonnelDragOver(e) {
  e.preventDefault();
  const el = document.getElementById("personnel-dropzone");
  if (el) {
    el.style.borderColor = "var(--primary)";
    el.style.backgroundColor = "var(--primary-light, #eef2ff)";
  }
}

function handlePersonnelDragLeave(e) {
  e.preventDefault();
  const el = document.getElementById("personnel-dropzone");
  if (el) {
    el.style.borderColor = "#cbd5e1";
    el.style.backgroundColor = "#ffffff";
  }
}

function handlePersonnelDrop(e) {
  e.preventDefault();
  handlePersonnelDragLeave(e);
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    processPersonnelFile(e.dataTransfer.files[0]);
  }
}

function handlePersonnelFileSelect(e) {
  if (e.target.files && e.target.files.length > 0) {
    processPersonnelFile(e.target.files[0]);
  }
}

function processPersonnelFile(file) {
  if (!file) return;
  const fileName = file.name;
  const ext = fileName.split(".").pop().toLowerCase();
  
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    showPersonnelImportError("Unsupported file type. Please upload a .xlsx, .xls, or .csv spreadsheet.");
    return;
  }

  document.getElementById("personnel-filename").textContent = fileName;
  document.getElementById("personnel-filesize").textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
  document.getElementById("personnel-file-info").style.display = "block";
  document.getElementById("personnel-error-alert").style.display = "none";

  const reader = new FileReader();

  if (ext === "csv") {
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const rows = parsePersonnelCSVText(text);
        validateAndPreviewPersonnel(rows);
      } catch (err) {
        showPersonnelImportError("Failed to parse CSV file: " + err.message);
      }
    };
    reader.readAsText(file);
  } else {
    reader.onload = (e) => {
      try {
        if (typeof XLSX === "undefined") {
          showPersonnelImportError("Spreadsheet parser is loading, please try again or upload CSV.");
          return;
        }
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        validateAndPreviewPersonnel(rows);
      } catch (err) {
        showPersonnelImportError("Error reading Excel spreadsheet: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function parsePersonnelCSVText(text) {
  const lines = text.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parsePersonnelCSVLine(lines[0]);
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parsePersonnelCSVLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] !== undefined ? values[idx] : "";
    });
    results.push(obj);
  }
  return results;
}

function parsePersonnelCSVLine(line) {
  const values = [];
  let cur = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(cur.trim());
      cur = "";
    } else {
      cur += char;
    }
  }
  values.push(cur.trim());
  return values;
}

function validateAndPreviewPersonnel(rows) {
  if (!rows || rows.length === 0) {
    showPersonnelImportError("The spreadsheet is empty or has no recognizable data rows.");
    return;
  }

  const existingEmps = expenseDb.getTable("employees");
  parsedPersonnelData = [];
  let validCount = 0;
  let invalidCount = 0;
  const tbody = document.getElementById("personnel-preview-tbody");
  tbody.innerHTML = "";

  const seenIds = new Set();

  rows.forEach((row, idx) => {
    const normalized = {};
    Object.keys(row).forEach(k => {
      const cleanKey = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      normalized[cleanKey] = (row[k] !== undefined && row[k] !== null) ? String(row[k]).trim() : "";
    });

    const empId = normalized["empid"] || normalized["id"] || normalized["employeeid"] || `EMP${String(existingEmps.length + idx + 1).padStart(3, "0")}`;
    const name = normalized["name"] || normalized["fullname"] || normalized["employeename"] || "";
    const email = normalized["email"] || normalized["corporateemail"] || "";
    const password = normalized["password"] || normalized["pass"] || normalized["pwd"] || normalized["userpassword"] || normalized["portalpassword"] || "";
    const country = (normalized["country"] || "ID").toUpperCase();
    const dept = normalized["department"] || normalized["dept"] || "IT";
    const manager = normalized["manager"] || normalized["approver"] || "Sarah";
    const grade = normalized["grade"] || normalized["employeegrade"] || "Staff";
    const costCenter = normalized["costcenter"] || "CC001";
    const role = normalized["assignedrole"] || normalized["role"] || "Employee";
    const project = normalized["project"] || "PRJ-JAK";
    const bankDetails = normalized["bankdetails"] || normalized["bank"] || "BCA 1234567890";
    const status = normalized["status"] || "Active";

    const errors = [];
    if (!name) errors.push("Missing Name");
    if (!email) errors.push("Missing Email");
    else if (!email.includes("@")) errors.push("Invalid Email format");

    if (seenIds.has(empId.toUpperCase())) {
      errors.push("Duplicate ID in file");
    }
    seenIds.add(empId.toUpperCase());

    const isExisting = existingEmps.some(e => e.id.toUpperCase() === empId.toUpperCase());
    const isValid = errors.length === 0;

    if (isValid) validCount++;
    else invalidCount++;

    const item = {
      id: empId,
      name,
      email,
      password,
      country,
      department: dept,
      manager,
      grade,
      costCenter,
      role: role || "Employee",
      project,
      bankDetails,
      status: status || "Active",
      isValid,
      isExisting,
      errors
    };
    parsedPersonnelData.push(item);

    const tr = document.createElement("tr");
    tr.style.backgroundColor = isValid ? (isExisting ? "#fefce8" : "#ffffff") : "#fef2f2";
    tr.innerHTML = `
      <td>
        ${isValid 
          ? (isExisting ? '<span class="status-badge pending" style="font-size:9.5px;">Update</span>' : '<span class="status-badge approved" style="font-size:9.5px;">New</span>')
          : `<span class="status-badge rejected" title="${errors.join(', ')}" style="font-size:9.5px;">Error</span>`
        }
      </td>
      <td><strong>${empId}</strong></td>
      <td><span style="font-weight:600;">${name || '<span style="color:#ef4444;">Missing</span>'}</span></td>
      <td>${email || '<span style="color:#ef4444;">Missing</span>'}</td>
      <td>
        <span class="status-badge" style="background:#f1f5f9; color:#334155; font-family:monospace; font-size:10px;" title="${password ? 'Password from spreadsheet' : 'Default password: employee123'}">
          <i class="fa-solid fa-key" style="color:var(--primary); font-size:9px; margin-right:3px;"></i>${password ? '••••••' : '<span style="color:var(--text-muted);">Default</span>'}
        </span>
      </td>
      <td>${country}</td>
      <td>${dept}</td>
      <td>${manager}</td>
      <td>${grade}</td>
      <td><code>${costCenter}</code></td>
      <td><span class="status-badge" style="background:#eef2ff; color:#4338ca;">${role}</span></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("personnel-stat-total").textContent = `${rows.length} Total Records`;
  document.getElementById("personnel-stat-valid").textContent = `${validCount} Valid`;
  
  const invalidBadge = document.getElementById("personnel-stat-invalid");
  if (invalidCount > 0) {
    invalidBadge.textContent = `${invalidCount} Invalid / Warning`;
    invalidBadge.style.display = "inline-flex";
  } else {
    invalidBadge.style.display = "none";
  }

  document.getElementById("personnel-preview-stats").textContent = `Parsed ${rows.length} rows (${validCount} valid, ${invalidCount} invalid)`;
  document.getElementById("personnel-preview-section").style.display = "block";
  document.getElementById("btn-confirm-personnel-import").disabled = validCount === 0;

  // Client License Limit capacity check for spreadsheet upload
  if (expenseDb.getLicenseStats) {
    const stats = expenseDb.getLicenseStats();
    const newItemsCount = parsedPersonnelData.filter(p => p.isValid && !p.isExisting).length;
    if (newItemsCount > stats.availableSlots) {
      showPersonnelImportError(`License Capacity Alert: Upload contains ${newItemsCount} new personnel, but only ${stats.availableSlots} license slots are available (${stats.activeUsers}/${stats.maxUsers} limit). Please increase license limit in Database Setup.`);
      if (stats.availableSlots === 0) {
        document.getElementById("btn-confirm-personnel-import").disabled = true;
      }
    }
  }

  if (invalidCount > 0 && validCount === 0) {
    showPersonnelImportError("All rows failed validation. Please fix email or required name columns and re-upload.");
  }
}

function showPersonnelImportError(msg) {
  const alert = document.getElementById("personnel-error-alert");
  const text = document.getElementById("personnel-error-text");
  if (alert && text) {
    text.textContent = msg;
    alert.style.display = "block";
  }
}

async function confirmPersonnelImport() {
  if (currentUser.role === "Auditor") return;
  if (!parsedPersonnelData || parsedPersonnelData.length === 0) return;

  const confirmBtn = document.getElementById("btn-confirm-personnel-import");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Importing...`;
  }

  const upsert = document.getElementById("personnel-opt-upsert")?.checked ?? true;
  const existingEmps = expenseDb.getTable("employees") || [];
  const existingUsers = expenseDb.getTable("users") || [];

  // Client License Limit Enforcement
  if (expenseDb.getLicenseStats) {
    const stats = expenseDb.getLicenseStats();
    const newValidCount = parsedPersonnelData.filter(item => item.isValid && !existingEmps.some(e => e.id && e.id.toLowerCase() === item.id.toLowerCase())).length;
    if (newValidCount > stats.availableSlots) {
      showToast(`Cannot import ${newValidCount} new personnel! Only ${stats.availableSlots} license slots available (${stats.activeUsers}/${stats.maxUsers} seats used). Upgrade license in Settings -> Database Setup.`, "error");
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Confirm Import`;
      }
      return;
    }
  }
  
  let importedCount = 0;
  let updatedCount = 0;
  const employeesToSave = [];
  const usersToSave = [];

  parsedPersonnelData.forEach((item, idx) => {
    if (!item.isValid) return;

    const empRecord = {
      id: item.id,
      name: item.name,
      email: item.email,
      country: item.country || "India",
      department: item.department || "General",
      manager: item.manager || "Unassigned",
      grade: item.grade || "L1",
      costCenter: item.costCenter || "CC001",
      bankDetails: item.bankDetails || "Bank Account",
      project: item.project || "General",
      status: item.status || "Active"
    };

    const exists = existingEmps.some(e => e.id && e.id.toLowerCase() === item.id.toLowerCase());

    if (exists && upsert) {
      employeesToSave.push(empRecord);
      const userExists = existingUsers.find(u => (u.employeeId && u.employeeId.toLowerCase() === item.id.toLowerCase()) || (u.email && u.email.toLowerCase() === item.email.toLowerCase()));
      if (userExists) {
        usersToSave.push({
          id: userExists.id,
          employeeId: item.id,
          name: item.name,
          email: item.email,
          role: item.role || userExists.role || "Employee",
          password: item.password ? item.password : (userExists.password || "employee123"),
          status: item.status || "Active"
        });
      } else {
        usersToSave.push({
          id: "USR" + Date.now().toString().slice(-4) + Math.floor(Math.random() * 900 + 100),
          employeeId: item.id,
          name: item.name,
          email: item.email,
          role: item.role || "Employee",
          password: item.password || "employee123",
          status: item.status || "Active"
        });
      }
      updatedCount++;
    } else if (!exists) {
      employeesToSave.push(empRecord);
      usersToSave.push({
        id: "USR" + (Date.now() + idx).toString().slice(-4) + Math.floor(Math.random() * 900 + 100),
        employeeId: item.id,
        name: item.name,
        email: item.email,
        role: item.role || "Employee",
        password: item.password || "employee123",
        status: item.status || "Active"
      });
      importedCount++;
    }
  });

  try {
    if (employeesToSave.length > 0) {
      await expenseDb.bulkUpsert("employees", employeesToSave);
    }
    if (usersToSave.length > 0) {
      await expenseDb.bulkUpsert("users", usersToSave);
    }
    await expenseDb.syncFromBackend();

    expenseDb.addLog(
      currentUser.employeeId || currentUser.id,
      currentUser.name,
      "Personnel Bulk Import",
      `Bulk onboarded ${importedCount} new employee(s) and updated ${updatedCount} existing record(s) via Excel Strategy.`
    );

    closePersonnelImportModal();
    renderEmployeesTables();
    renderRolesTable();
    showToast(`Successfully processed personnel import: ${importedCount} new, ${updatedCount} updated.`, "success");
  } catch (err) {
    console.error("[Personnel Import Error]", err);
    showToast("Failed to complete personnel import: " + (err.message || err), "error");
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Confirm Import`;
    }
  }
}

function updateRolePermission(role, field, value) {
  if (currentUser.role === "Auditor") return;

  const perms = expenseDb.getTable("permissions");
  const perm = perms.find(p => p.role.toLowerCase() === role.toLowerCase());
  if (perm) {
    const updated = { ...perm, [field]: value };
    expenseDb.updateRecord("permissions", "role", perm.role, updated);
    expenseDb.addLog(
      currentUser.employeeId || currentUser.id,
      currentUser.name,
      "Update Role Permission",
      `Changed permission '${field}' to '${value}' for role [${role}].`
    );
    showToast(`Updated '${field}' permission for role ${role}.`, "success");
  }
}

function filterEmployeeRoster() {
  const query = (document.getElementById("emp-search-input")?.value || "").toLowerCase().trim();
  const emps = expenseDb.getTable("employees");
  const users = expenseDb.getTable("users");
  const rosterBody = document.getElementById("admin-employee-table-body");
  if (!rosterBody) return;
  rosterBody.innerHTML = "";

  const filtered = emps.filter(e => {
    const user = users.find(u => u.employeeId === e.id || (u.email && e.email && u.email.toLowerCase() === e.email.toLowerCase()));
    const assignedRole = user ? user.role : "Employee";
    const str = `${e.id} ${e.name} ${e.email} ${e.country} ${e.department} ${e.manager} ${e.grade} ${e.costCenter} ${assignedRole} ${e.status}`.toLowerCase();
    return str.includes(query);
  });

  if (filtered.length === 0) {
    rosterBody.innerHTML = `<tr><td colspan="11" style="text-align:center; color:var(--text-muted); padding: 16px;">No employees match the search criteria.</td></tr>`;
    return;
  }

  filtered.forEach(e => {
    const user = users.find(u => u.employeeId === e.id || (u.email && e.email && u.email.toLowerCase() === e.email.toLowerCase()));
    const assignedRole = user ? user.role : "Employee";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${e.id}</strong></td>
      <td><span style="font-weight: 600; color: var(--text-dark);">${e.name}</span></td>
      <td>${e.email}</td>
      <td>${e.country}</td>
      <td>${e.department}</td>
      <td>${e.manager}</td>
      <td>${e.grade}</td>
      <td><code>${e.costCenter}</code></td>
      <td><span class="status-badge" style="background-color: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;">${assignedRole}</span></td>
      <td><span class="status-badge ${e.status === 'Active' ? 'approved' : 'draft'}">${e.status}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="editEmployee('${e.id}')" title="Edit Employee & Assign Role"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEmployee('${e.id}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''} title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    rosterBody.appendChild(row);
  });
}

function switchAdminTab(paneId) {
  document.querySelectorAll("#view-employees .admin-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  } else {
    const btn = Array.from(document.querySelectorAll("#view-employees .admin-tab-btn")).find(b => b.getAttribute("onclick") && b.getAttribute("onclick").includes(paneId));
    if (btn) btn.classList.add("active");
  }

  document.querySelectorAll("#view-employees .tab-pane").forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });
}

function populateEmployeeModalDropdowns(selectedValues = {}) {
  const cSelect = document.getElementById("admin-emp-country");
  if (cSelect) {
    cSelect.innerHTML = "";
    expenseDb.getTable("countries").forEach(c => {
      cSelect.innerHTML += `<option value="${c.code}">${c.name} (${c.code})</option>`;
    });
    if (selectedValues.country) cSelect.value = selectedValues.country;
  }

  const pSelect = document.getElementById("admin-emp-project");
  if (pSelect) {
    pSelect.innerHTML = "";
    expenseDb.getTable("projects").forEach(p => {
      pSelect.innerHTML += `<option value="${p.code}">${p.name} (${p.code})</option>`;
    });
    if (selectedValues.project) pSelect.value = selectedValues.project;
  }

  const dSelect = document.getElementById("admin-emp-dept");
  if (dSelect) {
    dSelect.innerHTML = "";
    expenseDb.getTable("departments").forEach(d => {
      dSelect.innerHTML += `<option value="${d.code}">${d.name}</option>`;
    });
    if (selectedValues.department) dSelect.value = selectedValues.department;
  }

  const mSelect = document.getElementById("admin-emp-manager");
  if (mSelect) {
    mSelect.innerHTML = "";
    const emps = expenseDb.getTable("employees");
    emps.forEach(e => {
      mSelect.innerHTML += `<option value="${e.name}">${e.name} (${e.id})</option>`;
    });
    if (selectedValues.manager) mSelect.value = selectedValues.manager;
  }

  const gSelect = document.getElementById("admin-emp-grade");
  if (gSelect) {
    gSelect.innerHTML = "";
    const grades = expenseDb.getTable("employeeGrades");
    if (grades && grades.length > 0) {
      grades.forEach(g => {
        gSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`;
      });
    } else {
      ["Staff", "Senior Staff", "Lead", "Manager", "Senior Manager", "Director", "Executive"].forEach(g => {
        gSelect.innerHTML += `<option value="${g}">${g}</option>`;
      });
    }
    if (selectedValues.grade) gSelect.value = selectedValues.grade;
  }

  const ccSelect = document.getElementById("admin-emp-cc");
  if (ccSelect) {
    ccSelect.innerHTML = "";
    expenseDb.getTable("costCenters").forEach(cc => {
      ccSelect.innerHTML += `<option value="${cc.code}">${cc.name}</option>`;
    });
    if (selectedValues.costCenter) ccSelect.value = selectedValues.costCenter;
  }

  const rSelect = document.getElementById("admin-emp-role");
  if (rSelect) {
    rSelect.innerHTML = "";
    const roles = expenseDb.getTable("roles");
    if (roles && roles.length > 0) {
      roles.forEach(r => {
        rSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`;
      });
    } else {
      ["Employee", "Manager", "Finance", "Administrator", "Auditor"].forEach(r => {
        rSelect.innerHTML += `<option value="${r}">${r}</option>`;
      });
    }
    if (selectedValues.role) {
      rSelect.value = selectedValues.role;
    } else {
      rSelect.value = "Employee";
    }
  }
}

function openEmployeeModal(empId = null) {
  if (currentUser.role === "Auditor") return;

  const modal = document.getElementById("employee-modal-overlay");
  if (!modal) return;

  const titleEl = document.getElementById("employee-modal-title");
  const submitBtn = document.getElementById("admin-emp-submit-btn");
  const idInput = document.getElementById("admin-emp-id");

  if (empId) {
    // Edit Existing Employee
    const emp = expenseDb.getTable("employees").find(e => e.id === empId);
    if (!emp) return;

    const user = expenseDb.getTable("users").find(u => u.employeeId === empId || (u.email && emp.email && u.email.toLowerCase() === emp.email.toLowerCase()));
    const assignedRole = user ? user.role : "Employee";

    if (titleEl) titleEl.innerText = `Edit Employee & Role: ${emp.name} (${emp.id})`;
    if (submitBtn) submitBtn.innerText = "Update Employee & Role";

    idInput.value = emp.id;
    idInput.readOnly = true;
    document.getElementById("admin-emp-name").value = emp.name || "";
    document.getElementById("admin-emp-email").value = emp.email || "";
    document.getElementById("admin-emp-desg").value = emp.designation || "";
    document.getElementById("admin-emp-status").value = emp.status || "Active";
    document.getElementById("admin-emp-pass").value = user ? user.password : "";

    populateEmployeeModalDropdowns({
      country: emp.country,
      project: emp.project,
      department: emp.department,
      manager: emp.manager,
      grade: emp.grade,
      costCenter: emp.costCenter,
      role: assignedRole
    });
  } else {
    // Register New Employee
    if (expenseDb.getLicenseStats) {
      const stats = expenseDb.getLicenseStats();
      if (stats.isLimitReached) {
        showToast(`Client license limit reached (${stats.activeUsers}/${stats.maxUsers} active seats). Increase user limit in Settings -> Database Setup to register more personnel.`, "warning");
      }
    }

    if (titleEl) titleEl.innerText = "Register Employee & Assign Role";
    if (submitBtn) submitBtn.innerText = "Save Employee & Role";

    // Auto-generate next Employee ID
    const emps = expenseDb.getTable("employees");
    let maxNum = 0;
    emps.forEach(e => {
      const match = (e.id || "").match(/EMP(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    const nextId = "EMP" + String(maxNum + 1).padStart(3, "0");

    idInput.value = nextId;
    idInput.readOnly = false;
    document.getElementById("admin-emp-name").value = "";
    document.getElementById("admin-emp-email").value = "";
    document.getElementById("admin-emp-desg").value = "";
    document.getElementById("admin-emp-status").value = "Active";
    document.getElementById("admin-emp-pass").value = "";

    populateEmployeeModalDropdowns();
  }

  modal.classList.add("active");
}

function editEmployee(empId) {
  openEmployeeModal(empId);
}

function deleteEmployee(empId) {
  if (currentUser.role === "Auditor") return;

  const emp = expenseDb.getTable("employees").find(e => e.id === empId);
  const empName = emp ? emp.name : empId;

  if (confirm(`Are you sure you want to remove employee ${empName} (${empId}) and their associated user login role?`)) {
    expenseDb.deleteRecord("employees", "id", empId);
    
    // Also remove associated user account
    const user = expenseDb.getTable("users").find(u => u.employeeId === empId || (emp && u.email && u.email.toLowerCase() === emp.email.toLowerCase()));
    if (user) {
      expenseDb.deleteRecord("users", "id", user.id);
    }

    expenseDb.addLog(currentUser.employeeId || currentUser.id, currentUser.name, "Delete Employee", `Removed employee record ${empName} (${empId}) and revoked role access.`);
    showToast(`Employee ${empName} deleted successfully.`, "success");

    renderEmployeesTables();
    if (activeTab === "masters") {
      renderEmployeeMaster();
      renderUserMaster();
    }
  }
}

function closeEmployeeModal() {
  const modal = document.getElementById("employee-modal-overlay");
  if (modal) modal.classList.remove("active");
}

function handleEmployeeCreate(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const idVal = document.getElementById("admin-emp-id").value.trim().toUpperCase();
  const nameVal = document.getElementById("admin-emp-name").value.trim();
  const emailVal = document.getElementById("admin-emp-email").value.trim();
  const desgVal = document.getElementById("admin-emp-desg").value.trim();
  const countryVal = document.getElementById("admin-emp-country").value;
  const projVal = document.getElementById("admin-emp-project").value;
  const deptVal = document.getElementById("admin-emp-dept").value;
  const managerVal = document.getElementById("admin-emp-manager").value;
  const gradeVal = document.getElementById("admin-emp-grade").value;
  const ccVal = document.getElementById("admin-emp-cc").value;
  const roleVal = document.getElementById("admin-emp-role").value;
  const passVal = document.getElementById("admin-emp-pass").value.trim();
  const statusVal = document.getElementById("admin-emp-status").value;

  const emps = expenseDb.getTable("employees");
  const existingEmp = emps.find(e => e.id === idVal);

  // Check client license capacity when creating new personnel
  if (!existingEmp && expenseDb.getLicenseStats) {
    const stats = expenseDb.getLicenseStats();
    if (stats.isLimitReached) {
      showToast(`Cannot register employee! Client user license limit reached (${stats.activeUsers}/${stats.maxUsers} seats). Increase license limit in Database / System Setup.`, "error");
      return;
    }
  }

  const empRecord = {
    id: idVal,
    name: nameVal,
    email: emailVal,
    country: countryVal,
    project: projVal,
    department: deptVal,
    manager: managerVal,
    designation: desgVal,
    grade: gradeVal,
    costCenter: ccVal,
    bankDetails: "Cleared bank details",
    status: statusVal
  };

  if (existingEmp) {
    expenseDb.updateRecord("employees", "id", idVal, empRecord);
  } else {
    expenseDb.addRecord("employees", empRecord);
  }

  // Handle User Account & Role Assignment in Users table
  const users = expenseDb.getTable("users");
  const existingUser = users.find(u => u.employeeId === idVal || (u.email && u.email.toLowerCase() === emailVal.toLowerCase()));
  const defaultPassword = passVal || (existingUser ? existingUser.password : (roleVal.toLowerCase() + "123"));

  if (existingUser) {
    const updatedUser = {
      employeeId: idVal,
      name: nameVal,
      email: emailVal,
      role: roleVal,
      password: defaultPassword,
      status: statusVal
    };
    expenseDb.updateRecord("users", "id", existingUser.id, updatedUser);
  } else {
    // Generate unique USR ID
    let maxUserNum = 0;
    users.forEach(u => {
      const match = (u.id || "").match(/USR(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxUserNum) maxUserNum = num;
      }
    });
    const newUserId = "USR" + String(maxUserNum + 1).padStart(3, "0");

    const newUser = {
      id: newUserId,
      employeeId: idVal,
      name: nameVal,
      email: emailVal,
      role: roleVal,
      password: defaultPassword,
      status: statusVal
    };
    expenseDb.addRecord("users", newUser);
  }

  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    existingEmp ? "Update Employee & Role" : "Register Employee & Role",
    `Saved employee ${nameVal} (${idVal}) with assigned role: ${roleVal}`
  );

  showToast(`Employee ${nameVal} saved and assigned role "${roleVal}" successfully!`, "success");
  closeEmployeeModal();
  
  // Refresh views
  renderEmployeesTables();
  if (activeTab === "masters") {
    renderEmployeeMaster();
    renderUserMaster();
  }
}

// ================= CONFIGURATIONS & SETTINGS PANEL =================

function renderSettingsTab() {
  loadGeneralErpSettings();
  renderCostCentersTable();
  renderCurrenciesTable();
  renderPoliciesTable();
  renderLicenseCard();
  updateSystemStats();
}

function renderLicenseCard() {
  if (!expenseDb.getLicenseStats) return;
  const stats = expenseDb.getLicenseStats();

  const clientInput = document.getElementById("cfg-license-client");
  const maxInput = document.getElementById("cfg-license-max");
  const tierInput = document.getElementById("cfg-license-tier");
  const keyInput = document.getElementById("cfg-license-key");
  const statText = document.getElementById("license-stat-text");
  const availText = document.getElementById("license-avail-text");
  const progressBar = document.getElementById("license-progress-bar");
  const badge = document.getElementById("license-card-badge");

  if (clientInput) clientInput.value = stats.clientName || "";
  if (maxInput) maxInput.value = stats.maxUsers || 50;
  if (tierInput) tierInput.value = stats.licenseTier || `Professional Edition (${stats.maxUsers} Seats)`;
  if (keyInput) keyInput.value = stats.licenseKey || "EXP-2026-ENT-50U-COMMERCIAL";

  if (statText) statText.innerText = `${stats.activeUsers} / ${stats.maxUsers} Active Users (${stats.utilizationPct}%)`;
  if (availText) availText.innerText = `${stats.availableSlots} Available License Seats Remaining`;

  if (progressBar) {
    progressBar.style.width = `${Math.min(100, stats.utilizationPct)}%`;
    if (stats.utilizationPct >= 100) {
      progressBar.style.background = "#ef4444";
    } else if (stats.utilizationPct >= 80) {
      progressBar.style.background = "#f59e0b";
    } else {
      progressBar.style.background = "linear-gradient(90deg, #4f46e5, #10b981)";
    }
  }

  if (badge) {
    if (stats.isLimitReached) {
      badge.className = "status-badge rejected";
      badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> License Limit Reached (${stats.activeUsers}/${stats.maxUsers})`;
    } else {
      badge.className = "status-badge approved";
      badge.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Active License (${stats.maxUsers} Seats)`;
    }
  }
}

function setLicensePreset(num) {
  const maxInput = document.getElementById("cfg-license-max");
  const tierInput = document.getElementById("cfg-license-tier");
  if (maxInput) maxInput.value = num;
  if (tierInput) tierInput.value = `Professional Edition (${num} Seats)`;
}

async function handleSaveClientLicense(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const maxUsers = parseInt(document.getElementById("cfg-license-max").value || "50", 10);
  const clientName = document.getElementById("cfg-license-client").value.trim();
  const licenseTier = document.getElementById("cfg-license-tier").value.trim();
  const licenseKey = document.getElementById("cfg-license-key").value.trim();

  if (isNaN(maxUsers) || maxUsers < 1) {
    showToast("Please enter a valid user license limit greater than 0.", "error");
    return;
  }

  await expenseDb.updateLicenseConfig({
    maxUsers,
    clientName,
    licenseTier,
    licenseKey
  });

  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    "Update Client License",
    `Configured client user license limit to ${maxUsers} seats for '${clientName}'.`
  );

  showToast(`Client commercial license limit successfully saved (${maxUsers} users limit)!`, "success");
  renderLicenseCard();
  renderEmployeesTables();
}

function loadGeneralErpSettings() {
  const savedSettings = JSON.parse(localStorage.getItem("EXPENSE_ERP_CONFIG") || "{}");
  if (savedSettings.companyName) document.getElementById("cfg-comp-name").value = savedSettings.companyName;
  if (savedSettings.taxId) document.getElementById("cfg-tax-id").value = savedSettings.taxId;
  if (savedSettings.baseCurrency) document.getElementById("cfg-base-curr").value = savedSettings.baseCurrency;
  if (savedSettings.fiscalStart) document.getElementById("cfg-fiscal-start").value = savedSettings.fiscalStart;
  if (savedSettings.dateFormat) document.getElementById("cfg-date-format").value = savedSettings.dateFormat;
  if (savedSettings.autoApprove !== undefined) document.getElementById("cfg-auto-approve").value = savedSettings.autoApprove;
  if (savedSettings.receiptThreshold !== undefined) document.getElementById("cfg-receipt-threshold").value = savedSettings.receiptThreshold;
  if (savedSettings.approvalGrace !== undefined) document.getElementById("cfg-approval-grace").value = savedSettings.approvalGrace;
  if (savedSettings.mileageRate !== undefined) document.getElementById("cfg-mileage-rate").value = savedSettings.mileageRate;
  if (savedSettings.allowAdvances !== undefined) document.getElementById("cfg-allow-advances").checked = savedSettings.allowAdvances;
  if (savedSettings.notifySubmission !== undefined) document.getElementById("cfg-notify-submission").checked = savedSettings.notifySubmission;
  if (savedSettings.notifyPending !== undefined) document.getElementById("cfg-notify-pending").checked = savedSettings.notifyPending;
  if (savedSettings.notifyPayout !== undefined) document.getElementById("cfg-notify-payout").checked = savedSettings.notifyPayout;
  if (savedSettings.autoArchive !== undefined) document.getElementById("cfg-auto-archive").checked = savedSettings.autoArchive;
}

function handleSaveErpSettings(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const config = {
    companyName: document.getElementById("cfg-comp-name").value.trim(),
    taxId: document.getElementById("cfg-tax-id").value.trim(),
    baseCurrency: document.getElementById("cfg-base-curr").value,
    fiscalStart: document.getElementById("cfg-fiscal-start").value,
    dateFormat: document.getElementById("cfg-date-format").value,
    autoApprove: parseFloat(document.getElementById("cfg-auto-approve").value || 0),
    receiptThreshold: parseFloat(document.getElementById("cfg-receipt-threshold").value || 0),
    approvalGrace: parseInt(document.getElementById("cfg-approval-grace").value || 7, 10),
    mileageRate: parseFloat(document.getElementById("cfg-mileage-rate").value || 0),
    allowAdvances: document.getElementById("cfg-allow-advances").checked,
    notifySubmission: document.getElementById("cfg-notify-submission").checked,
    notifyPending: document.getElementById("cfg-notify-pending").checked,
    notifyPayout: document.getElementById("cfg-notify-payout").checked,
    autoArchive: document.getElementById("cfg-auto-archive").checked,
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem("EXPENSE_ERP_CONFIG", JSON.stringify(config));
  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    "Update ERP System Settings",
    `Saved general ERP preferences for ${config.companyName}.`
  );
  showToast("ERP system settings & company preferences saved successfully!", "success");
}

/* Cost Center Management */
function renderCostCentersTable(records = null) {
  if (!records) records = expenseDb.getTable("costCenters");
  const tbody = document.getElementById("tbl-settings-costcenters");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No cost centers configured.</td></tr>`;
    return;
  }

  records.forEach(cc => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${cc.code}</strong></td>
      <td>${cc.name}</td>
      <td>${cc.department || "-"}</td>
      <td><span class="status-badge ${cc.status === 'Active' ? 'approved' : 'draft'}">${cc.status || 'Active'}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="openCostCenterModal('${cc.code}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCostCenter('${cc.code}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterCostCentersTable(query) {
  const records = expenseDb.getTable("costCenters");
  const filtered = records.filter(cc =>
    (cc.code && cc.code.toLowerCase().includes(query.toLowerCase())) ||
    (cc.name && cc.name.toLowerCase().includes(query.toLowerCase()))
  );
  renderCostCentersTable(filtered);
}

function openCostCenterModal(code = null) {
  if (currentUser.role === "Auditor") return;
  const modal = document.getElementById("modal-set-costcenter");
  if (!modal) return;

  const dSelect = document.getElementById("m-cc-dept");
  if (dSelect) {
    dSelect.innerHTML = `<option value="">General Corporate</option>`;
    expenseDb.getTable("departments").forEach(d => {
      dSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`;
    });
  }

  const title = document.getElementById("title-modal-cc");
  const btn = document.getElementById("btn-save-cc");
  const codeInput = document.getElementById("m-cc-code");

  if (code) {
    const cc = expenseDb.getTable("costCenters").find(c => c.code === code);
    if (!cc) return;
    if (title) title.innerText = `Edit Cost Center: ${cc.code}`;
    if (btn) btn.innerText = "Update Cost Center";
    codeInput.value = cc.code;
    codeInput.readOnly = true;
    document.getElementById("m-cc-name").value = cc.name || "";
    if (dSelect) dSelect.value = cc.department || "";
    document.getElementById("m-cc-status").value = cc.status || "Active";
  } else {
    if (title) title.innerText = "Add New Cost Center";
    if (btn) btn.innerText = "Save Cost Center";
    codeInput.value = "CC00" + (expenseDb.getTable("costCenters").length + 1);
    codeInput.readOnly = false;
    document.getElementById("m-cc-name").value = "";
    document.getElementById("m-cc-status").value = "Active";
  }

  modal.classList.add("active");
}

function closeCostCenterModal() {
  const modal = document.getElementById("modal-set-costcenter");
  if (modal) modal.classList.remove("active");
}

function handleCostCenterSave(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const code = document.getElementById("m-cc-code").value.trim().toUpperCase();
  const name = document.getElementById("m-cc-name").value.trim();
  const department = document.getElementById("m-cc-dept") ? document.getElementById("m-cc-dept").value : "";
  const status = document.getElementById("m-cc-status").value;

  const existing = expenseDb.getTable("costCenters").find(c => c.code === code);
  const record = { code, name, department, status };

  if (existing) {
    expenseDb.updateRecord("costCenters", "code", code, record);
    showToast(`Cost center ${code} updated successfully.`, "success");
  } else {
    expenseDb.addRecord("costCenters", record);
    showToast(`Cost center ${code} created successfully.`, "success");
  }

  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    existing ? "Update Cost Center" : "Add Cost Center",
    `Saved cost center [${code} - ${name}].`
  );

  closeCostCenterModal();
  renderCostCentersTable();
}

function deleteCostCenter(code) {
  if (currentUser.role === "Auditor") return;
  if (confirm(`Are you sure you want to delete Cost Center [${code}]?`)) {
    expenseDb.deleteRecord("costCenters", "code", code);
    expenseDb.addLog(currentUser.employeeId || currentUser.id, currentUser.name, "Delete Cost Center", `Removed cost center [${code}].`);
    showToast(`Cost center ${code} deleted.`, "success");
    renderCostCentersTable();
  }
}

/* Currencies Management */
function renderCurrenciesTable(records = null) {
  if (!records) records = expenseDb.getTable("currencies");
  const tbody = document.getElementById("tbl-settings-currencies");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No currencies configured.</td></tr>`;
    return;
  }

  records.forEach(c => {
    const rateDisplay = c.exchangeRate ? formatIDR(c.exchangeRate) : (c.code === 'IDR' ? '1.00 (Base)' : '-');
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${c.code}</strong></td>
      <td><code>${c.symbol || '$'}</code></td>
      <td>${c.name}</td>
      <td style="font-weight: 600;">${rateDisplay}</td>
      <td>${c.decimalPlaces !== undefined ? c.decimalPlaces : 2}</td>
      <td><span class="status-badge ${c.status === 'Active' ? 'approved' : 'draft'}">${c.status || 'Active'}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="openCurrencyModal('${c.code}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCurrency('${c.code}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterCurrenciesTable(query) {
  const records = expenseDb.getTable("currencies");
  const filtered = records.filter(c =>
    (c.code && c.code.toLowerCase().includes(query.toLowerCase())) ||
    (c.name && c.name.toLowerCase().includes(query.toLowerCase()))
  );
  renderCurrenciesTable(filtered);
}

function openCurrencyModal(code = null) {
  if (currentUser.role === "Auditor") return;
  const modal = document.getElementById("modal-set-currency");
  if (!modal) return;

  const title = document.getElementById("title-modal-curr");
  const btn = document.getElementById("btn-save-curr");
  const codeInput = document.getElementById("m-curr-code");

  if (code) {
    const c = expenseDb.getTable("currencies").find(curr => curr.code === code);
    if (!c) return;
    if (title) title.innerText = `Edit Currency: ${c.code}`;
    if (btn) btn.innerText = "Update Currency";
    codeInput.value = c.code;
    codeInput.readOnly = true;
    document.getElementById("m-curr-symbol").value = c.symbol || "";
    document.getElementById("m-curr-name").value = c.name || "";
    document.getElementById("m-curr-rate").value = c.exchangeRate || (c.code === 'IDR' ? 1 : 15500);
    document.getElementById("m-curr-decimals").value = c.decimalPlaces !== undefined ? c.decimalPlaces : 2;
    document.getElementById("m-curr-status").value = c.status || "Active";
  } else {
    if (title) title.innerText = "Add New Currency";
    if (btn) btn.innerText = "Save Currency";
    codeInput.value = "";
    codeInput.readOnly = false;
    document.getElementById("m-curr-symbol").value = "";
    document.getElementById("m-curr-name").value = "";
    document.getElementById("m-curr-rate").value = "";
    document.getElementById("m-curr-decimals").value = "2";
    document.getElementById("m-curr-status").value = "Active";
  }

  modal.classList.add("active");
}

function closeCurrencyModal() {
  const modal = document.getElementById("modal-set-currency");
  if (modal) modal.classList.remove("active");
}

function handleCurrencySave(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const code = document.getElementById("m-curr-code").value.trim().toUpperCase();
  const symbol = document.getElementById("m-curr-symbol").value.trim();
  const name = document.getElementById("m-curr-name").value.trim();
  const exchangeRate = parseFloat(document.getElementById("m-curr-rate").value || 1);
  const decimalPlaces = parseInt(document.getElementById("m-curr-decimals").value || 2, 10);
  const status = document.getElementById("m-curr-status").value;

  const existing = expenseDb.getTable("currencies").find(c => c.code === code);
  const record = { code, symbol, name, exchangeRate, decimalPlaces, status };

  if (existing) {
    expenseDb.updateRecord("currencies", "code", code, record);
    showToast(`Currency ${code} updated successfully.`, "success");
  } else {
    expenseDb.addRecord("currencies", record);
    showToast(`Currency ${code} created successfully.`, "success");
  }

  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    existing ? "Update Currency" : "Add Currency",
    `Saved currency [${code} - ${name}].`
  );

  closeCurrencyModal();
  renderCurrenciesTable();
  renderCurrencyMaster();
}

function deleteCurrency(code) {
  if (currentUser.role === "Auditor") return;
  if (code === "IDR") {
    showToast("Base reporting currency (IDR) cannot be removed.", "error");
    return;
  }
  if (confirm(`Are you sure you want to delete Currency [${code}]?`)) {
    expenseDb.deleteRecord("currencies", "code", code);
    expenseDb.addLog(currentUser.employeeId || currentUser.id, currentUser.name, "Delete Currency", `Removed currency [${code}].`);
    showToast(`Currency ${code} deleted.`, "success");
    renderCurrenciesTable();
    renderCurrencyMaster();
  }
}

/* Policies Management */
function renderPoliciesTable(records = null) {
  if (!records) records = expenseDb.getTable("expensePolicies");
  const body = document.getElementById("settings-policies-table-body");
  if (!body) return;
  body.innerHTML = "";

  if (records.length === 0) {
    body.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No policy rules configured.</td></tr>`;
    return;
  }

  records.forEach(p => {
    const row = document.createElement("tr");
    
    let actionsHtml = currentUser.role !== "Auditor" ? `
      <div class="d-flex gap-1">
        <button class="btn btn-secondary btn-sm" onclick="openPolicyModal('${p.id}')"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePolicy('${p.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    ` : `<span style="color:var(--text-muted); font-size:11px;">Locked</span>`;

    row.innerHTML = `
      <td style="font-weight:700;">${p.id}</td>
      <td style="font-weight:600; color:var(--primary);">${p.type}</td>
      <td><strong>${formatIDR(p.limit)}</strong></td>
      <td>${p.currency || 'IDR'}</td>
      <td>${p.scope || 'Global'}</td>
      <td>
        <span class="status-badge" style="background-color:${p.action === 'Block' ? 'var(--rejected-bg)' : 'var(--pending-bg)'}; color:${p.action === 'Block' ? 'var(--rejected-color)' : 'var(--pending-color)'};">
          ${p.action}
        </span>
      </td>
      <td>${actionsHtml}</td>
    `;
    body.appendChild(row);
  });
}

function filterPoliciesTable(query) {
  const records = expenseDb.getTable("expensePolicies");
  const filtered = records.filter(p =>
    (p.id && p.id.toLowerCase().includes(query.toLowerCase())) ||
    (p.type && p.type.toLowerCase().includes(query.toLowerCase())) ||
    (p.action && p.action.toLowerCase().includes(query.toLowerCase()))
  );
  renderPoliciesTable(filtered);
}

function openPolicyModal(policyId = null) {
  if (currentUser.role === "Auditor") return;
  const modal = document.getElementById("policy-modal-overlay");
  if (!modal) return;

  const typeSelect = document.getElementById("admin-pol-type");
  if (typeSelect) {
    typeSelect.innerHTML = "";
    expenseDb.getTable("expenseCategories").forEach(c => {
      typeSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
  }

  const title = document.getElementById("title-modal-policy");
  const btn = document.getElementById("btn-save-policy");
  const idInput = document.getElementById("admin-pol-id");

  if (policyId) {
    const p = expenseDb.getTable("expensePolicies").find(pol => pol.id === policyId);
    if (!p) return;
    if (title) title.innerText = `Edit Policy: ${p.id}`;
    if (btn) btn.innerText = "Update Policy";
    idInput.value = p.id;
    idInput.readOnly = true;
    if (typeSelect) typeSelect.value = p.type;
    document.getElementById("admin-pol-limit").value = p.limit || 0;
    if (document.getElementById("admin-pol-curr")) document.getElementById("admin-pol-curr").value = p.currency || "IDR";
    document.getElementById("admin-pol-action").value = p.action || "Warning";
  } else {
    if (title) title.innerText = "Configure Spending Rule";
    if (btn) btn.innerText = "Save Policy Limit";
    idInput.value = "POL00" + (expenseDb.getTable("expensePolicies").length + 1);
    idInput.readOnly = false;
    document.getElementById("admin-pol-limit").value = "";
    document.getElementById("admin-pol-action").value = "Warning";
  }

  modal.classList.add("active");
}

function closePolicyModal() {
  const modal = document.getElementById("policy-modal-overlay");
  if (modal) modal.classList.remove("active");
}

function handlePolicyCreate(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const idVal = document.getElementById("admin-pol-id").value.trim().toUpperCase();
  const typeVal = document.getElementById("admin-pol-type").value;
  const limitVal = parseFloat(document.getElementById("admin-pol-limit").value || 0);
  const currVal = document.getElementById("admin-pol-curr") ? document.getElementById("admin-pol-curr").value : "IDR";
  const actVal = document.getElementById("admin-pol-action").value;

  const newPolicy = {
    id: idVal,
    type: typeVal,
    limit: limitVal,
    currency: currVal,
    scope: "Global",
    action: actVal
  };

  const existing = expenseDb.getTable("expensePolicies").find(p => p.id === idVal);
  if (existing) {
    expenseDb.updateRecord("expensePolicies", "id", idVal, newPolicy);
    showToast(`Policy ${idVal} updated successfully!`, "success");
  } else {
    expenseDb.addRecord("expensePolicies", newPolicy);
    showToast(`Policy ${idVal} created successfully!`, "success");
  }

  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    existing ? "Update Policy" : "Add Policy",
    `Configured spending rule ${idVal} for ${typeVal} at limit ${formatIDR(limitVal)}.`
  );

  closePolicyModal();
  renderPoliciesTable();
}

function deletePolicy(policyId) {
  if (currentUser.role === "Auditor") return;

  if (confirm(`Delete policy rule ${policyId}?`)) {
    expenseDb.deleteRecord("expensePolicies", "id", policyId);
    expenseDb.addLog(currentUser.employeeId || currentUser.id, currentUser.name, "Delete Policy", `Removed spending limit config ${policyId}`);
    showToast("Spending policy deleted.", "success");
    renderPoliciesTable();
  }
}

function updateSystemStats() {
  const statEl = document.getElementById("sys-stat-records");
  if (statEl) {
    let count = 0;
    ["expenses", "employees", "users", "projects", "departments", "costCenters", "currencies", "expensePolicies"].forEach(tbl => {
      count += expenseDb.getTable(tbl).length;
    });
    statEl.innerText = `${count} records across 8 tables`;
  }
}

function switchSettingsTab(paneId) {
  document.querySelectorAll("#view-settings .admin-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  }

  document.querySelectorAll("#view-settings .tab-pane").forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });

  if (paneId === "set-tab-costcenters") renderCostCentersTable();
  else if (paneId === "set-tab-currencies") renderCurrenciesTable();
  else if (paneId === "set-tab-policies") renderPoliciesTable();
  else if (paneId === "set-tab-system") updateSystemStats();
}

function closePolicyModal() {
  document.getElementById("policy-modal-overlay").classList.remove("active");
}

function handlePolicyCreate(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const idVal = document.getElementById("admin-pol-id").value;
  const typeVal = document.getElementById("admin-pol-type").value;
  const limitVal = parseFloat(document.getElementById("admin-pol-limit").value || 0);
  const actVal = document.getElementById("admin-pol-action").value;

  const newPolicy = {
    id: idVal,
    type: typeVal,
    limit: limitVal,
    currency: "IDR",
    scope: "Global",
    action: actVal
  };

  expenseDb.addRecord("expensePolicies", newPolicy);
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Add Policy", `Created spending rule ${idVal} for ${typeVal} at limit ${formatIDR(limitVal)}`);
  showToast("Spending policy created successfully!", "success");
  closePolicyModal();
  renderPoliciesTable();
}

function resetDatabase() {
  if (currentUser.role === "Auditor") return;

  if (confirm("WARNING: This will clear all transactions and restore the default database to state Rp 48.5M. Proceed?")) {
    expenseDb.reset();
    showToast("Mock database reset to default seeds.", "success");
    navigateToTab("dashboard");
    refreshUI();
  }
}

// ================= NOTIFICATIONS PANEL =================

function toggleNotifications() {
  showToast("System Messages: 1. Sarah approved expense report EXP003. 2. Payout check EXP001 settled successfully.", "success");
}

// ================= AUDIT DRAWER =================

function openAuditDrawer() {
  const drawer = document.getElementById("audit-drawer-panel");
  const container = document.getElementById("audit-drawer-logs");
  container.innerHTML = "";

  const logs = [...expenseDb.getTable("auditLogs")].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  logs.forEach(l => {
    const item = document.createElement("div");
    item.className = "audit-log-item";
    const date = new Date(l.timestamp).toLocaleTimeString();
    
    item.innerHTML = `
      <div class="audit-log-time">${date} - User: ${l.userName}</div>
      <div class="audit-log-title">${l.action}</div>
      <div class="audit-log-desc">${l.details}</div>
    `;
    container.appendChild(item);
  });

  drawer.classList.add("active");
}

function closeAuditDrawer() {
  document.getElementById("audit-drawer-panel").classList.remove("active");
}

// ================= DATA EXPORTS =================

function exportData(format) {
  const expenses = expenseDb.getTable("expenses");
  const today = new Date().toISOString().split("T")[0];
  
  if (format === "pdf") {
    const headers = ["ID", "Date", "Employee", "Project", "Dept", "Category", "Type", "Amount", "Method", "Status"];
    const rows = expenses.map(e => [
      e.id || "",
      e.date || "",
      e.employeeName || "",
      e.project || "",
      e.department || "",
      e.category || "",
      e.type || "",
      `${e.currency || 'USD'} ${Number(e.amount || 0).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`,
      e.paymentMethod || "",
      e.status || ""
    ]);

    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });

      // Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("EXPENSE ERP - Corporate Transaction Ledger", 14, 13);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${today} | Total Records: ${expenses.length}`, doc.internal.pageSize.getWidth() - 14, 13, { align: "right" });

      doc.autoTable({
        startY: 26,
        head: [headers],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 26, left: 10, right: 10, bottom: 10 }
      });

      doc.save(`Expense_ERP_Ledger_${today}.pdf`);
      showToast("Exported transaction ledger as PDF file.", "success");
    } else {
      printTableDirectly("Expense ERP - Transaction Ledger", headers, rows);
      showToast("Opening printable PDF preview...", "success");
    }
  } else if (format === "csv") {
    let csv = "Expense ID,Date,Employee,Project,Department,Category,Type,Amount,Currency,Payment Method,Status\n";
    expenses.forEach(e => {
      csv += `"${e.id}","${e.date}","${e.employeeName}","${e.project}","${e.department}","${e.category}","${e.type}",${e.amount},"${e.currency}","${e.paymentMethod}","${e.status}"\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Expense_ERP_Ledger_${today}.csv`;
    link.click();
    showToast("Exported database ledger as CSV file.", "success");
  } else if (format === "json") {
    const jsonStr = JSON.stringify(expenses, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Expense_ERP_Ledger_${today}.json`;
    link.click();
    showToast("Exported database ledger as JSON file.", "success");
  }
  
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Data Export", `Exported transaction ledger in ${format.toUpperCase()} format.`);
}

function printTableDirectly(title, headers, rows) {
  const win = window.open("", "_blank");
  if (!win) return;
  const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b; }
    h2 { margin-bottom: 4px; color: #4f46e5; }
    p { font-size: 11px; color: #64748b; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
    th { background: #4f46e5; color: #fff; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { padding: 0; } }
  </style></head><body>
    <h2>${title}</h2>
    <p>Generated on ${new Date().toLocaleString()}</p>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <script>window.onload = function() { window.print(); }<\/script>
  </body></html>`;
  win.document.write(html);
  win.document.close();
}

// ================= TOASTS & UTILITIES =================

function showToast(message, type = "success") {
  const toast = document.getElementById("system-toast");
  const icon = document.getElementById("toast-icon");
  const text = document.getElementById("toast-message");

  text.innerText = message;
  toast.className = `alert-toast active ${type}`;
  
  if (type === "success") {
    icon.className = "fa-solid fa-circle-check";
    icon.style.color = "var(--approved-color)";
  } else {
    icon.className = "fa-solid fa-circle-xmark";
    icon.style.color = "var(--rejected-color)";
  }

  setTimeout(() => {
    toast.classList.remove("active");
  }, 4000);
}

// ================= SECURE LOGOUT =================

function logout() {
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Logout", "Session ended.");
  sessionStorage.removeItem("EXPENSE_SESSION");
  window.location.href = "/login";
}

// ================= MASTER SETUP CRUD =================

let activeMasterTab = "country";

function switchMasterTab(paneId) {
  activeMasterTab = paneId.replace("m-tab-", "");
  
  // Toggle subtabs
  document.querySelectorAll("#view-masters .admin-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  if (window.event && window.event.currentTarget) {
    window.event.currentTarget.classList.add("active");
  } else {
    const btn = Array.from(document.querySelectorAll("#view-masters .admin-tab-btn")).find(b => b.getAttribute("onclick") && b.getAttribute("onclick").includes(paneId));
    if (btn) btn.classList.add("active");
  }

  document.querySelectorAll("#view-masters .tab-pane").forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });

  renderMasterTable(activeMasterTab);
}

function renderMastersView() {
  const activePaneId = `m-tab-${activeMasterTab}`;
  document.querySelectorAll("#view-masters .admin-tab-btn").forEach(btn => {
    if (btn.getAttribute("onclick") && btn.getAttribute("onclick").includes(activePaneId)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
  document.querySelectorAll("#view-masters .tab-pane").forEach(pane => {
    if (pane.id === activePaneId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });
  renderMasterTable(activeMasterTab);
}

function renderMasterTable(type, filteredRecords = null) {
  if (type === "country") renderCountryMaster(filteredRecords);
  else if (type === "project") renderProjectMaster(filteredRecords);
  else if (type === "department") renderDepartmentMaster(filteredRecords);
  else if (type === "currency") renderCurrencyMaster(filteredRecords);
  else if (type === "category") renderCategoryMaster(filteredRecords);
}

function renderCountryMaster(records = null) {
  if (!records) records = expenseDb.getTable("countries");
  const tbody = document.getElementById("tbl-m-country");
  if (!tbody) return;
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.code}</strong></td>
      <td>${r.name}</td>
      <td><code>${r.currency}</code></td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('countries', 'code', '${r.code}', renderCountryMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderProjectMaster(records = null) {
  if (!records) records = expenseDb.getTable("projects");
  const tbody = document.getElementById("tbl-m-project");
  if (!tbody) return;
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.code}</strong></td>
      <td>${r.name}</td>
      <td>${r.country}</td>
      <td>${r.manager}</td>
      <td>${r.startDate}</td>
      <td>${r.endDate}</td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('projects', 'code', '${r.code}', renderProjectMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderDepartmentMaster(records = null) {
  if (!records) records = expenseDb.getTable("departments");
  const tbody = document.getElementById("tbl-m-department");
  if (!tbody) return;
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.code}</strong></td>
      <td>${r.name}</td>
      <td>${r.manager}</td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('departments', 'code', '${r.code}', renderDepartmentMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderCurrencyMaster(records = null) {
  if (!records) records = expenseDb.getTable("currencies");
  const tbody = document.getElementById("tbl-m-currency");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding: 16px;">No currencies configured.</td></tr>`;
    return;
  }

  records.forEach(c => {
    const rateDisplay = c.exchangeRate ? (typeof formatIDR === 'function' ? formatIDR(c.exchangeRate) : c.exchangeRate) : (c.code === 'IDR' ? '1.00 (Base)' : '-');
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${c.code}</strong></td>
      <td><code>${c.symbol || '$'}</code></td>
      <td>${c.name}</td>
      <td style="font-weight: 600;">${rateDisplay}</td>
      <td>${c.decimalPlaces !== undefined ? c.decimalPlaces : 2}</td>
      <td><span class="status-badge ${c.status === 'Active' ? 'approved' : 'draft'}">${c.status || 'Active'}</span></td>
      <td>
        <div class="d-flex gap-1">
          <button class="btn btn-secondary btn-sm" onclick="openCurrencyModal('${c.code}')" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-pen-to-square"></i> Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('currencies', 'code', '${c.code}', renderCurrencyMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderCategoryMaster(records = null) {
  if (!records) records = expenseDb.getTable("expenseCategories");
  const tbody = document.getElementById("tbl-m-category");
  if (!tbody) return;
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.code}</strong></td>
      <td>${r.name}</td>
      <td><i class="fa-solid fa-${r.icon}"></i> <code>${r.icon}</code></td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('expenseCategories', 'code', '${r.code}', renderCategoryMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// Filter / Search function for all Master tables in real-time
function filterMasterTable(type, query) {
  let dbTable = "";
  
  if (type === "country") dbTable = "countries";
  else if (type === "project") dbTable = "projects";
  else if (type === "department") dbTable = "departments";
  else if (type === "currency") dbTable = "currencies";
  else if (type === "category") dbTable = "expenseCategories";

  if (!dbTable) return;
  const records = expenseDb.getTable(dbTable);
  const filtered = records.filter(r => {
    return Object.values(r).some(val => 
      String(val).toLowerCase().includes(query.toLowerCase())
    );
  });

  renderMasterTable(type, filtered);
}

// ================= MASTER SETUP EXCEL TEMPLATE DOWNLOAD & UPLOAD =================

const MASTER_EXCEL_CONFIGS = {
  country: {
    table: "countries",
    title: "Country Master",
    filename: "Country_Master_Template.xlsx",
    sheetName: "Countries",
    headers: ["Country Code", "Country Name", "Default Currency", "Status"],
    displayCols: ["code", "name", "currency", "status"],
    sample: [
      ["US", "United States", "USD", "Active"],
      ["DE", "Germany", "EUR", "Active"],
      ["IN", "India", "INR", "Active"],
      ["SG", "Singapore", "SGD", "Active"]
    ],
    mapRow: function(row) {
      const get = (keys, def = "") => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          for (const orig of Object.keys(row)) {
            if (orig.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK) {
              const val = row[orig];
              if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
            }
          }
        }
        return def;
      };
      const code = get(["Country Code", "code", "countrycode"]).toUpperCase();
      const name = get(["Country Name", "name", "countryname"]);
      const currency = get(["Default Currency", "currency", "defaultcurrency"]).toUpperCase() || "USD";
      const status = get(["Status", "status"], "Active");
      if (!code || !name) return null;
      return { code, name, currency, status: status === "Inactive" ? "Inactive" : "Active" };
    }
  },
  project: {
    table: "projects",
    title: "Project Master",
    filename: "Project_Master_Template.xlsx",
    sheetName: "Projects",
    headers: ["Project Code", "Project Name", "Country", "Manager", "Start Date", "End Date", "Status"],
    displayCols: ["code", "name", "country", "manager", "startDate", "endDate", "status"],
    sample: [
      ["PRJ-SIN", "Singapore Tech Center", "SG", "Nikita", "2026-06-01", "2026-12-31", "Active"],
      ["PRJ-LON", "London Regional Hub", "GB", "Sarah", "2026-07-01", "2027-06-30", "Active"]
    ],
    mapRow: function(row) {
      const get = (keys, def = "") => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          for (const orig of Object.keys(row)) {
            if (orig.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK) {
              const val = row[orig];
              if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
            }
          }
        }
        return def;
      };
      const code = get(["Project Code", "code", "projectcode"]).toUpperCase();
      const name = get(["Project Name", "name", "projectname"]);
      const country = get(["Country", "country", "countrycode"]).toUpperCase();
      const manager = get(["Manager", "manager", "head"]);
      const startDate = get(["Start Date", "startDate", "start"], new Date().toISOString().split("T")[0]);
      const endDate = get(["End Date", "endDate", "end"], new Date(Date.now() + 365*86400000).toISOString().split("T")[0]);
      const status = get(["Status", "status"], "Active");
      if (!code || !name) return null;
      return { code, name, country, manager, startDate, endDate, status: status === "Inactive" ? "Inactive" : "Active" };
    }
  },
  department: {
    table: "departments",
    title: "Department Master",
    filename: "Department_Master_Template.xlsx",
    sheetName: "Departments",
    headers: ["Department Code", "Department Name", "Manager / Head", "Status"],
    displayCols: ["code", "name", "manager", "status"],
    sample: [
      ["MKT", "Marketing & Growth", "Nikita", "Active"],
      ["RND", "Research & Innovation", "Sarah", "Active"],
      ["LEG", "Legal & Compliance", "Nikita", "Active"]
    ],
    mapRow: function(row) {
      const get = (keys, def = "") => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          for (const orig of Object.keys(row)) {
            if (orig.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK) {
              const val = row[orig];
              if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
            }
          }
        }
        return def;
      };
      const code = get(["Department Code", "code", "departmentcode", "deptcode"]).toUpperCase();
      const name = get(["Department Name", "name", "departmentname", "deptname"]);
      const manager = get(["Manager / Head", "Manager", "manager", "head"]);
      const status = get(["Status", "status"], "Active");
      if (!code || !name) return null;
      return { code, name, manager, status: status === "Inactive" ? "Inactive" : "Active" };
    }
  },
  currency: {
    table: "currencies",
    title: "Currency Master",
    filename: "Currency_Master_Template.xlsx",
    sheetName: "Currencies",
    headers: ["Currency Code", "Currency Name", "Symbol", "Exchange Rate (vs IDR)", "Decimal Places", "Status"],
    displayCols: ["code", "name", "symbol", "exchangeRate", "decimalPlaces", "status"],
    sample: [
      ["SGD", "Singapore Dollar", "S$", 11800, 2, "Active"],
      ["GBP", "British Pound", "£", 20000, 2, "Active"],
      ["JPY", "Japanese Yen", "¥", 105, 0, "Active"]
    ],
    mapRow: function(row) {
      const get = (keys, def = "") => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          for (const orig of Object.keys(row)) {
            if (orig.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK) {
              const val = row[orig];
              if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
            }
          }
        }
        return def;
      };
      const code = get(["Currency Code", "code", "currencycode", "iso"]).toUpperCase();
      const name = get(["Currency Name", "name", "currencyname"]);
      const symbol = get(["Symbol", "symbol"], "$");
      const rawRate = get(["Exchange Rate (vs IDR)", "exchangeRate", "rate", "exchangerate"]);
      const exchangeRate = parseFloat(rawRate) || (code === "IDR" ? 1 : 15500);
      const rawDec = get(["Decimal Places", "decimalPlaces", "decimals"]);
      const decimalPlaces = rawDec !== "" ? parseInt(rawDec, 10) : 2;
      const status = get(["Status", "status"], "Active");
      if (!code || !name) return null;
      return { code, name, symbol, exchangeRate, decimalPlaces, status: status === "Inactive" ? "Inactive" : "Active" };
    }
  },
  category: {
    table: "expenseCategories",
    title: "Expense Category Master",
    filename: "Expense_Category_Master_Template.xlsx",
    sheetName: "ExpenseCategories",
    headers: ["Category Code", "Category Name", "Icon Class", "Status"],
    displayCols: ["code", "name", "icon", "status"],
    sample: [
      ["LOG", "Logistics & Freight", "truck", "Active"],
      ["WEL", "Health & Wellness", "heart-pulse", "Active"],
      ["EDU", "Training & Education", "graduation-cap", "Active"]
    ],
    mapRow: function(row) {
      const get = (keys, def = "") => {
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          for (const orig of Object.keys(row)) {
            if (orig.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanK) {
              const val = row[orig];
              if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
            }
          }
        }
        return def;
      };
      const code = get(["Category Code", "code", "categorycode"]).toUpperCase();
      const name = get(["Category Name", "name", "categoryname"]);
      const icon = get(["Icon Class", "icon", "iconclass"], "receipt");
      const status = get(["Status", "status"], "Active");
      if (!code || !name) return null;
      return { code, name, icon, status: status === "Inactive" ? "Inactive" : "Active" };
    }
  }
};

let currentExcelUploadType = "country";
let parsedExcelRecords = [];

function downloadMasterTemplate(type) {
  const cfg = MASTER_EXCEL_CONFIGS[type];
  if (!cfg) return;

  if (typeof XLSX !== "undefined") {
    const ws_data = [cfg.headers, ...cfg.sample];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = cfg.headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
    XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);
    XLSX.writeFile(wb, cfg.filename);
  } else {
    let csv = cfg.headers.map(h => `"${h}"`).join(",") + "\n";
    cfg.sample.forEach(row => {
      csv += row.map(val => `"${val}"`).join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = cfg.filename.replace(".xlsx", ".csv");
    link.click();
  }
  showToast(`Downloaded ${cfg.title} Excel template.`, "success");
}

function downloadCurrentMasterTemplate() {
  downloadMasterTemplate(currentExcelUploadType);
}

function openExcelUploadModal(type) {
  if (currentUser.role === "Auditor") {
    showToast("Auditors have read-only access and cannot import data.", "error");
    return;
  }

  currentExcelUploadType = type;
  parsedExcelRecords = [];

  const cfg = MASTER_EXCEL_CONFIGS[type];
  const modal = document.getElementById("modal-excel-upload");
  if (!modal || !cfg) return;

  const titleEl = document.getElementById("title-modal-excel-upload");
  if (titleEl) {
    titleEl.innerHTML = `<i class="fa-solid fa-file-excel" style="color: #107c41;"></i> Import ${cfg.title} via Excel`;
  }
  const targetNameEl = document.getElementById("excel-upload-target-name");
  if (targetNameEl) {
    targetNameEl.innerText = cfg.title;
  }

  // Reset inputs & preview
  const fileInput = document.getElementById("excel-file-input");
  if (fileInput) fileInput.value = "";
  
  const fileInfo = document.getElementById("excel-file-info");
  if (fileInfo) fileInfo.style.display = "none";

  const previewSec = document.getElementById("excel-preview-section");
  if (previewSec) previewSec.style.display = "none";

  const errAlert = document.getElementById("excel-error-alert");
  if (errAlert) errAlert.style.display = "none";

  const confirmBtn = document.getElementById("btn-confirm-excel-import");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Import Records`;
  }

  modal.classList.add("active");
}

function closeExcelUploadModal() {
  const modal = document.getElementById("modal-excel-upload");
  if (modal) modal.classList.remove("active");
  parsedExcelRecords = [];
}

function handleExcelDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById("excel-dropzone");
  if (dz) {
    dz.style.borderColor = "var(--primary)";
    dz.style.backgroundColor = "#f0f4ff";
  }
}

function handleExcelDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  const dz = document.getElementById("excel-dropzone");
  if (dz) {
    dz.style.borderColor = "var(--border-color, #cbd5e1)";
    dz.style.backgroundColor = "#ffffff";
  }
}

function handleExcelDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  handleExcelDragLeave(e);

  const dt = e.dataTransfer;
  if (dt && dt.files && dt.files.length > 0) {
    processExcelUploadFile(dt.files[0]);
  }
}

function handleExcelFileSelect(e) {
  if (e.target.files && e.target.files.length > 0) {
    processExcelUploadFile(e.target.files[0]);
  }
}

function processExcelUploadFile(file) {
  const cfg = MASTER_EXCEL_CONFIGS[currentExcelUploadType];
  const errAlert = document.getElementById("excel-error-alert");
  const errText = document.getElementById("excel-error-text");
  const confirmBtn = document.getElementById("btn-confirm-excel-import");

  if (!file) return;

  const validExts = [".xlsx", ".xls", ".csv"];
  const fileName = file.name.toLowerCase();
  const isValidExt = validExts.some(ext => fileName.endsWith(ext));
  if (!isValidExt) {
    if (errAlert && errText) {
      errText.innerText = "Unsupported file format. Please upload an Excel (.xlsx, .xls) or .csv file.";
      errAlert.style.display = "block";
    }
    return;
  }

  // Update file info display
  const fileInfo = document.getElementById("excel-file-info");
  const fileNameEl = document.getElementById("excel-filename");
  const fileSizeEl = document.getElementById("excel-filesize");
  if (fileInfo && fileNameEl && fileSizeEl) {
    fileNameEl.innerText = file.name;
    const sizeKB = (file.size / 1024).toFixed(1);
    fileSizeEl.innerText = `(${sizeKB} KB)`;
    fileInfo.style.display = "flex";
  }

  if (errAlert) errAlert.style.display = "none";

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      if (typeof XLSX === "undefined") {
        throw new Error("Excel parsing engine (SheetJS) is not loaded.");
      }

      const workbook = XLSX.read(data, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("The uploaded spreadsheet is empty or contains no data rows.");
      }

      const parsed = [];
      rawRows.forEach((row, idx) => {
        const record = cfg.mapRow(row);
        if (record) {
          parsed.push(record);
        }
      });

      if (parsed.length === 0) {
        throw new Error(`No valid rows recognized. Please ensure headers match the expected ${cfg.title} template.`);
      }

      parsedExcelRecords = parsed;

      // Update badge
      const badge = document.getElementById("excel-rowcount-badge");
      if (badge) {
        badge.innerText = `${parsed.length} valid records parsed`;
        badge.className = "status-badge approved";
      }

      // Render Preview Table
      renderExcelPreviewTable(cfg, parsed);

      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Import ${parsed.length} Records`;
      }
    } catch (err) {
      console.error("[Excel Upload Error]", err);
      if (errAlert && errText) {
        errText.innerText = err.message || "Failed to parse Excel file.";
        errAlert.style.display = "block";
      }
      if (confirmBtn) confirmBtn.disabled = true;
    }
  };

  reader.onerror = function() {
    if (errAlert && errText) {
      errText.innerText = "Error reading uploaded file.";
      errAlert.style.display = "block";
    }
  };

  reader.readAsArrayBuffer(file);
}

function renderExcelPreviewTable(cfg, records) {
  const previewSec = document.getElementById("excel-preview-section");
  const thead = document.getElementById("excel-preview-thead");
  const tbody = document.getElementById("excel-preview-tbody");
  const stats = document.getElementById("excel-preview-stats");
  if (!previewSec || !thead || !tbody) return;

  const existingList = expenseDb.getTable(cfg.table);
  const existingCodes = new Set(existingList.map(r => String(r.code).toUpperCase()));

  thead.innerHTML = `
    <tr>
      <th>#</th>
      ${cfg.headers.map(h => `<th>${h}</th>`).join("")}
      <th>Action</th>
    </tr>
  `;

  tbody.innerHTML = "";
  const previewRows = records.slice(0, 10);
  previewRows.forEach((r, idx) => {
    const isUpdate = existingCodes.has(String(r.code).toUpperCase());
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx + 1}</td>
      ${cfg.displayCols.map(col => `<td>${r[col] !== undefined ? r[col] : '-'}</td>`).join("")}
      <td>
        <span class="status-badge ${isUpdate ? 'draft' : 'approved'}" style="font-size: 10px;">
          ${isUpdate ? 'Update' : 'New'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (stats) {
    stats.innerText = records.length > 10 
      ? `Showing first 10 of ${records.length} records` 
      : `${records.length} records ready`;
  }

  previewSec.style.display = "block";
}

async function confirmExcelImport() {
  if (currentUser.role === "Auditor") return;
  if (!parsedExcelRecords || parsedExcelRecords.length === 0) {
    showToast("No parsed records to import.", "error");
    return;
  }

  const cfg = MASTER_EXCEL_CONFIGS[currentExcelUploadType];
  if (!cfg) return;

  const confirmBtn = document.getElementById("btn-confirm-excel-import");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Importing...`;
  }

  const optUpsert = document.getElementById("excel-opt-upsert") ? document.getElementById("excel-opt-upsert").checked : true;
  const currentList = expenseDb.getTable(cfg.table);
  const existingCodes = new Set(currentList.map(r => String(r.code).toUpperCase()));

  let toImport = parsedExcelRecords;
  if (!optUpsert) {
    toImport = parsedExcelRecords.filter(r => !existingCodes.has(String(r.code).toUpperCase()));
  }

  if (toImport.length === 0) {
    showToast("All records already exist and 'Update existing' is unchecked. Nothing imported.", "error");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Import Records`;
    }
    return;
  }

  try {
    if (typeof expenseDb.bulkUpsert === "function") {
      await expenseDb.bulkUpsert(cfg.table, toImport);
    } else {
      toImport.forEach(r => {
        const exists = currentList.find(x => String(x.code).toUpperCase() === String(r.code).toUpperCase());
        if (exists) {
          expenseDb.updateRecord(cfg.table, "code", exists.code, r);
        } else {
          expenseDb.addRecord(cfg.table, r);
        }
      });
    }
    await expenseDb.syncFromBackend();

    expenseDb.addLog(
      currentUser.employeeId || currentUser.id,
      currentUser.name,
      "Excel Master Import",
      `Bulk imported ${toImport.length} records into ${cfg.title}.`
    );

    showToast(`Successfully imported ${toImport.length} records into ${cfg.title}!`, "success");
    closeExcelUploadModal();

    // Re-render active table
    renderMasterTable(activeMasterTab);
    if (activeMasterTab === "currency") {
      renderCurrenciesTable();
    }
  } catch (err) {
    console.error("[Excel Import Error]", err);
    showToast("Failed to save imported records: " + err.message, "error");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Import Records`;
    }
  }
}

// Open modal setups and dynamic selections
function openMasterModal(type) {
  if (currentUser.role === "Auditor") return;

  if (type === "employee") {
    openEmployeeModal();
    return;
  }

  const modal = document.getElementById(`modal-m-${type}`);
  if (!modal) return;

  // Clear modal inputs
  const form = modal.querySelector("form");
  if (form) form.reset();

  // Populate relational values
  if (type === "country") {
    const currSelect = document.getElementById("m-country-currency");
    if (currSelect) {
      currSelect.innerHTML = "";
      expenseDb.getTable("currencies").forEach(c => {
        currSelect.innerHTML += `<option value="${c.code}">${c.name} (${c.code})</option>`;
      });
    }
  } else if (type === "project") {
    const cSelect = document.getElementById("m-proj-country");
    if (cSelect) {
      cSelect.innerHTML = "";
      expenseDb.getTable("countries").forEach(c => {
        cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
      });
    }

    const mSelect = document.getElementById("m-proj-manager");
    if (mSelect) {
      mSelect.innerHTML = "";
      expenseDb.getTable("employees").forEach(e => {
        mSelect.innerHTML += `<option value="${e.name}">${e.name} (${e.id})</option>`;
      });
    }
  } else if (type === "department") {
    const mSelect = document.getElementById("m-dept-manager");
    if (mSelect) {
      mSelect.innerHTML = "";
      expenseDb.getTable("employees").forEach(e => {
        mSelect.innerHTML += `<option value="${e.name}">${e.name} (${e.id})</option>`;
      });
    }
  } else if (type === "user") {
    const eSelect = document.getElementById("m-user-employee");
    if (eSelect) {
      eSelect.innerHTML = `<option value="">Select Employee</option>`;
      expenseDb.getTable("employees").forEach(e => {
        eSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`;
      });
    }

    const rSelect = document.getElementById("m-user-role");
    if (rSelect) {
      rSelect.innerHTML = "";
      const roles = expenseDb.getTable("roles");
      if (roles && roles.length > 0) {
        roles.forEach(r => {
          rSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`;
        });
      } else {
        ["Employee", "Manager", "Finance", "Administrator", "Auditor"].forEach(r => {
          rSelect.innerHTML += `<option value="${r}">${r}</option>`;
        });
      }
    }
  }

  modal.classList.add("active");
}

function closeMasterModal(type) {
  if (type === "employee") {
    closeEmployeeModal();
    return;
  }
  const modal = document.getElementById(`modal-m-${type}`);
  if (modal) modal.classList.remove("active");
}

function autoFillUserFields() {
  const empId = document.getElementById("m-user-employee").value;
  if (!empId) return;

  const emp = expenseDb.getTable("employees").find(e => e.id === empId);
  if (emp) {
    document.getElementById("m-user-name").value = emp.name;
    document.getElementById("m-user-email").value = emp.email;

    const existingUser = expenseDb.getTable("users").find(u => u.employeeId === empId);
    if (existingUser) {
      document.getElementById("m-user-role").value = existingUser.role;
      document.getElementById("m-user-status").value = existingUser.status;
    }
  }
}

function handleMasterCreate(event, type) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  let newRecord = {};
  let tblKey = "";
  let logAction = "";

  if (type === "country") {
    const code = document.getElementById("m-country-code").value.trim().toUpperCase();
    const name = document.getElementById("m-country-name").value.trim();
    const currency = document.getElementById("m-country-currency").value;
    const status = document.getElementById("m-country-status").value;

    newRecord = { code, name, currency, status };
    tblKey = "countries";
    logAction = "Add Country Master";
    expenseDb.addRecord(tblKey, newRecord);
  } else if (type === "project") {
    const code = document.getElementById("m-proj-code").value.trim().toUpperCase();
    const name = document.getElementById("m-proj-name").value.trim();
    const country = document.getElementById("m-proj-country").value;
    const manager = document.getElementById("m-proj-manager").value;
    const startDate = document.getElementById("m-proj-start").value;
    const endDate = document.getElementById("m-proj-end").value;
    const status = document.getElementById("m-proj-status").value;

    newRecord = { code, name, country, manager, startDate, endDate, status };
    tblKey = "projects";
    logAction = "Add Project Master";
    expenseDb.addRecord(tblKey, newRecord);
  } else if (type === "department") {
    const code = document.getElementById("m-dept-code").value.trim().toUpperCase();
    const name = document.getElementById("m-dept-name").value.trim();
    const manager = document.getElementById("m-dept-manager").value;
    const status = document.getElementById("m-dept-status").value;

    newRecord = { code, name, manager, status };
    tblKey = "departments";
    logAction = "Add Department Master";
    expenseDb.addRecord(tblKey, newRecord);
  } else if (type === "user") {
    const employeeId = document.getElementById("m-user-employee").value;
    const name = document.getElementById("m-user-name").value.trim();
    const email = document.getElementById("m-user-email").value.trim();
    const role = document.getElementById("m-user-role").value;
    const password = document.getElementById("m-user-pass").value || (role.toLowerCase() + "123");
    const status = document.getElementById("m-user-status").value;

    const users = expenseDb.getTable("users");
    const existingUser = users.find(u => u.employeeId === employeeId || (u.email && u.email.toLowerCase() === email.toLowerCase()));

    if (existingUser) {
      newRecord = {
        employeeId,
        name,
        email,
        role,
        password: password || existingUser.password,
        status
      };
      expenseDb.updateRecord("users", "id", existingUser.id, newRecord);
    } else {
      let maxUserNum = 0;
      users.forEach(u => {
        const match = (u.id || "").match(/USR(\d+)/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxUserNum) maxUserNum = num;
        }
      });
      const newUserId = "USR" + String(maxUserNum + 1).padStart(3, "0");

      newRecord = {
        id: newUserId,
        employeeId,
        name,
        email,
        role,
        password,
        status
      };
      expenseDb.addRecord("users", newRecord);
    }
    tblKey = "users";
    logAction = "Save User Account & Role";
    // Also refresh employees roster
    renderEmployeesTables();
  } else if (type === "role") {
    const name = document.getElementById("m-role-name").value.trim();
    const desc = document.getElementById("m-role-desc").value.trim();
    const status = document.getElementById("m-role-status").value;

    newRecord = { name, desc, status };
    tblKey = "roles";
    logAction = "Add Role Master";
    expenseDb.addRecord(tblKey, newRecord);

    // Also add to permissions
    const perms = expenseDb.getTable("permissions");
    if (!perms.find(p => p.role.toLowerCase() === name.toLowerCase())) {
      expenseDb.addRecord("permissions", {
        role: name,
        userSetup: 0,
        addExpense: 1,
        approveExpense: 0,
        financeVerify: 0,
        reports: "Own",
        systemSetup: 0
      });
    }
  } else if (type === "category") {
    const code = document.getElementById("m-cat-code").value.trim().toUpperCase();
    const name = document.getElementById("m-cat-name").value.trim();
    const icon = document.getElementById("m-cat-icon").value;
    const status = document.getElementById("m-cat-status").value;

    newRecord = { code, name, icon, status };
    tblKey = "expenseCategories";
    logAction = "Add Category Master";
    expenseDb.addRecord(tblKey, newRecord);
  }

  expenseDb.addLog(currentUser.employeeId || currentUser.id, currentUser.name, logAction, `Saved core master entry details.`);
  showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} Master saved successfully!`, "success");
  
  closeMasterModal(type);
  renderMasterTable(type);
}

function deleteMasterRecord(table, idKey, idVal, renderFunc) {
  if (currentUser.role === "Auditor") return;

  if (confirm(`Are you sure you want to delete this master record: [${idVal}]?`)) {
    expenseDb.deleteRecord(table, idKey, idVal);
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Delete Master Entry", `Deleted entry [${idVal}] from ${table}.`);
    showToast("Master record deleted.", "success");
    renderFunc();
  }
}

// ================= ANALYTICS REPORT FILTER LOGIC =================

function populateReportFilterDropdowns() {
  const cSelect = document.getElementById("rep-filter-country");
  const pSelect = document.getElementById("rep-filter-project");
  const dSelect = document.getElementById("rep-filter-dept");
  const eSelect = document.getElementById("rep-filter-employee");
  const catSelect = document.getElementById("rep-filter-category");

  if (!cSelect || !pSelect || !dSelect || !eSelect || !catSelect) return;

  cSelect.innerHTML = `<option value="All">All Countries</option>`;
  pSelect.innerHTML = `<option value="All">All Projects</option>`;
  dSelect.innerHTML = `<option value="All">All Departments</option>`;
  eSelect.innerHTML = `<option value="All">All Employees</option>`;
  catSelect.innerHTML = `<option value="All">All Categories</option>`;

  expenseDb.getTable("countries").forEach(c => { cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`; });
  expenseDb.getTable("projects").forEach(p => { pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`; });
  expenseDb.getTable("departments").forEach(d => { dSelect.innerHTML += `<option value="${d.code}">${d.name}</option>`; });
  expenseDb.getTable("employees").forEach(e => { eSelect.innerHTML += `<option value="${e.name}">${e.name}</option>`; });
  expenseDb.getTable("expenseCategories").forEach(cat => { catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`; });
}

function applyReportFilters() {
  const country = document.getElementById("rep-filter-country").value;
  const project = document.getElementById("rep-filter-project").value;
  const dept = document.getElementById("rep-filter-dept").value;
  const employee = document.getElementById("rep-filter-employee").value;
  const category = document.getElementById("rep-filter-category").value;
  const startDate = document.getElementById("rep-filter-start").value;
  const endDate = document.getElementById("rep-filter-end").value;

  let filtered = expenseDb.getTable("expenses").filter(e => e.status !== "DRAFT");

  if (country !== "All") {
    filtered = filtered.filter(e => e.country === country);
  }
  if (project !== "All") {
    filtered = filtered.filter(e => e.project === project);
  }
  if (dept !== "All") {
    filtered = filtered.filter(e => e.department === dept);
  }
  if (employee !== "All") {
    filtered = filtered.filter(e => e.employeeName === employee);
  }
  if (category !== "All") {
    filtered = filtered.filter(e => e.category === category);
  }
  if (startDate) {
    filtered = filtered.filter(e => new Date(e.date) >= new Date(startDate));
  }
  if (endDate) {
    filtered = filtered.filter(e => new Date(e.date) <= new Date(endDate));
  }

  // Render the analytical charts with the filtered expenses!
  renderReportsViewCharts(filtered);
}

function resetReportFilters() {
  document.getElementById("rep-filter-country").value = "All";
  document.getElementById("rep-filter-project").value = "All";
  document.getElementById("rep-filter-dept").value = "All";
  document.getElementById("rep-filter-employee").value = "All";
  document.getElementById("rep-filter-category").value = "All";
  document.getElementById("rep-filter-start").value = "";
  document.getElementById("rep-filter-end").value = "";

  applyReportFilters();
}

// ================= GLOBAL LEDGER RENDERING =================

function renderAdminLedger(records = null) {
  if (!records) {
    records = expenseDb.getTable("expenses").filter(e => e.status !== "DRAFT");
  }

  const container = document.getElementById("tbl-admin-ledger");
  if (!container) return;
  container.innerHTML = "";

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No records found in transaction database.</td></tr>`;
    return;
  }

  const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td><strong>${e.employeeName}</strong></td>
      <td>${e.project}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600;">${formatIDR(e.amount)}</td>
      <td>${formatDate(e.date)}</td>
      <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td>${e.remarks || "-"}</td>
    `;
    container.appendChild(row);
  });
}

function filterAdminLedger(query) {
  const records = expenseDb.getTable("expenses").filter(e => e.status !== "DRAFT");
  const filtered = records.filter(e => {
    return (
      e.id.toLowerCase().includes(query.toLowerCase()) ||
      e.employeeName.toLowerCase().includes(query.toLowerCase()) ||
      e.project.toLowerCase().includes(query.toLowerCase()) ||
      e.category.toLowerCase().includes(query.toLowerCase()) ||
      e.amount.toString().includes(query) ||
      e.status.toLowerCase().includes(query.toLowerCase()) ||
      (e.remarks && e.remarks.toLowerCase().includes(query.toLowerCase()))
    );
  });
  renderAdminLedger(filtered);
}

// ================= LOG EXPENSE FORM (ADMIN MODE) =================

function setupAdminExpenseForm() {
  const empSelect = document.getElementById("adm-form-emp");
  const cSelect = document.getElementById("adm-form-country");
  const catSelect = document.getElementById("adm-form-cat");

  if (!empSelect || !cSelect || !catSelect) return;

  empSelect.innerHTML = `<option value="">Select Employee</option>`;
  cSelect.innerHTML = `<option value="">Select Country</option>`;
  catSelect.innerHTML = `<option value="">Select Category</option>`;

  expenseDb.getTable("employees").forEach(emp => {
    empSelect.innerHTML += `<option value="${emp.id}">${emp.name} (${emp.id})</option>`;
  });
  expenseDb.getTable("countries").forEach(c => {
    cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
  });
  expenseDb.getTable("expenseCategories").forEach(cat => {
    catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
  });

  // Bind cascading changes
  cSelect.onchange = () => {
    const pSelect = document.getElementById("adm-form-project");
    if (!pSelect) return;
    pSelect.innerHTML = `<option value="">Select Project</option>`;
    const code = cSelect.value;
    if (code) {
      expenseDb.getTable("projects").filter(p => p.country === code && p.status === "Active").forEach(p => {
        pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
      });
    }
  };

  const pSelect = document.getElementById("adm-form-project");
  if (pSelect) {
    pSelect.innerHTML = `<option value="">Select Project (Select Country first)</option>`;
    pSelect.onchange = () => {
      const dSelect = document.getElementById("adm-form-dept");
      if (!dSelect) return;
      dSelect.innerHTML = `<option value="">Select Department</option>`;
      if (pSelect.value) {
        expenseDb.getTable("departments").filter(d => d.status === "Active").forEach(d => {
          dSelect.innerHTML += `<option value="${d.code}">${d.name}</option>`;
        });
      }
    };
  }

  const dSelect = document.getElementById("adm-form-dept");
  if (dSelect) dSelect.innerHTML = `<option value="">Select Department (Select Project first)</option>`;

  document.getElementById("adm-form-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("adm-form-amount").value = "";
  document.getElementById("adm-form-remarks").value = "";
}

function handleAdminExpenseSubmit(event) {
  event.preventDefault();

  const empId = document.getElementById("adm-form-emp").value;
  const emp = expenseDb.getTable("employees").find(e => e.id === empId);
  if (!emp) {
    showToast("Please select a valid employee.", "error");
    return;
  }

  const date = document.getElementById("adm-form-date").value;
  const country = document.getElementById("adm-form-country").value;
  const project = document.getElementById("adm-form-project").value;
  const dept = document.getElementById("adm-form-dept").value;
  const category = document.getElementById("adm-form-cat").value;
  const amount = parseFloat(document.getElementById("adm-form-amount").value);
  const method = document.getElementById("adm-form-method").value;
  const remarks = document.getElementById("adm-form-remarks").value.trim();

  // Create new claim entry directly into PENDING_MANAGER
  const newId = "EXP" + String(expenseDb.getTable("expenses").length + 1).padStart(3, "0");
  const newExp = {
    id: newId,
    employeeId: emp.id,
    employeeName: emp.name,
    date,
    country,
    project,
    department: dept,
    category,
    type: "Default",
    amount,
    currency: "IDR",
    paymentMethod: method,
    receiptAttached: false,
    receiptUrl: "",
    status: "PENDING_MANAGER",
    remarks,
    history: []
  };

  expenseDb.addRecord("expenses", newExp);
  expenseDb.addLog(currentUser.employeeId || currentUser.id, currentUser.name, "Submit Expense (Admin)", `Logged claim request ${newId} for ${emp.name}.`);

  showToast(`Successfully logged claim ${newId} for employee ${emp.name}!`, "success");
  navigateToTab("my-expenses");
}

// ================= GLOBAL APPROVALS QUEUE =================

function renderAdminApprovals() {
  const expenses = expenseDb.getTable("expenses");
  const pendingVerify = expenses.filter(e => e.status === "PENDING_MANAGER" || e.status === "PENDING_FINANCE" || e.status === "FINANCE_APPROVED");

  const container = document.getElementById("tbl-admin-approvals");
  if (!container) return;
  container.innerHTML = "";

  if (pendingVerify.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No corporate claims currently pending approval.</td></tr>`;
    return;
  }

  const sorted = [...pendingVerify].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td><strong>${e.employeeName}</strong></td>
      <td>${e.category}</td>
      <td style="font-weight: 600;">${formatIDR(e.amount)}</td>
      <td>${formatDate(e.date)}</td>
      <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
    `;
    container.appendChild(row);
  });
}

// ================= REIMBURSEMENT PAYMENTS TRACKING =================

function renderAdminReimbursements() {
  const records = expenseDb.getTable("reimbursements");

  const container = document.getElementById("tbl-admin-reimbursements");
  if (!container) return;
  container.innerHTML = "";

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No paid payouts registered.</td></tr>`;
    return;
  }

  const sorted = [...records].sort((a, b) => new Date(b.paidDate || b.paymentDate) - new Date(a.paidDate || a.paymentDate));

  sorted.forEach(r => {
    const row = document.createElement("tr");
    const refId = r.reportId || r.expenseId || r.id;
    const dateVal = r.paidDate || r.paymentDate || new Date().toISOString();
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--text-muted);">${r.id}</td>
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${refId}')">${refId}</td>
      <td><strong>${r.employeeName || r.employeeId}</strong></td>
      <td style="font-weight: 600;">${formatIDR(r.amount)}</td>
      <td>${r.paymentMethod || "Bank Transfer"}</td>
      <td>${formatDate(dateVal)}</td>
      <td><span class="status-badge approved">${r.status}</span></td>
    `;
    container.appendChild(row);
  });
}

// ================= EXPENSE DETAILS OVERLAY =================

function viewExpenseDetails(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  if (!expense) return;

  document.getElementById("det-exp-id").innerText = expense.id;
  const statusEl = document.getElementById("det-exp-status");
  statusEl.innerText = expense.status.replace(/_/g, " ");
  statusEl.className = `status-badge ${expense.status.toLowerCase()}`;

  document.getElementById("det-exp-date").innerText = formatDate(expense.date);
  document.getElementById("det-exp-employee").innerText = expense.employeeName;
  document.getElementById("det-exp-project").innerText = expense.project || "-";
  document.getElementById("det-exp-category").innerText = expense.category;
  document.getElementById("det-exp-type").innerText = expense.type;
  document.getElementById("det-exp-amount").innerText = formatIDR(expense.amount);
  document.getElementById("det-exp-payment").innerText = expense.paymentMethod;
  document.getElementById("det-exp-created").innerText = expense.dateCreated ? formatDate(expense.dateCreated) : "-";
  document.getElementById("det-exp-desc").innerText = expense.description || "No description provided.";
  document.getElementById("det-exp-remarks").innerText = expense.remarks || "No remarks/logs.";

  const imgContainer = document.getElementById("det-exp-receipt-preview-container");
  const imgElement = document.getElementById("det-exp-receipt-img");
  const downloadLink = document.getElementById("det-exp-receipt-download");

  if (expense.receiptUrl && expense.receiptUrl.trim() !== "" && expense.receiptUrl !== "receipt_attached.png") {
    let resolvedSrc;
    if (expense.receiptUrl.startsWith("http") || expense.receiptUrl.startsWith("data:")) {
      resolvedSrc = expense.receiptUrl;
    } else {
      const seededImages = {
        "receipt_flight.jpg": "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=500&auto=format&fit=crop&q=60",
        "receipt_hotel.jpg": "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60",
        "receipt_dinner.jpg": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=60",
        "receipt_stationery.png": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop&q=60"
      };
      resolvedSrc = seededImages[expense.receiptUrl] || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60";
    }
    imgElement.src = resolvedSrc;
    const fileName = expense.receiptUrl.startsWith("data:") ? `receipt_${expense.id}.jpg` : (expense.receiptUrl.split("/").pop().split("?")[0] || `receipt_${expense.id}.jpg`);
    downloadLink.href = resolvedSrc;
    downloadLink.download = fileName;
    downloadLink.style.display = "inline-flex";
    imgContainer.style.display = "block";
  } else {
    imgContainer.style.display = "none";
  }

  document.getElementById("expense-details-overlay").classList.add("active");
}

function closeExpenseDetails() {
  document.getElementById("expense-details-overlay").classList.remove("active");
}

// ================= PROFILE & CHANGE PASSWORD =================

function openChangePasswordModal() {
  const modal = document.getElementById("modal-change-password");
  if (!modal) return;
  
  if (currentUser) {
    if (document.getElementById("cp-user-name")) document.getElementById("cp-user-name").innerText = currentUser.name || "-";
    if (document.getElementById("cp-user-role")) document.getElementById("cp-user-role").innerText = currentUser.role || "-";
    if (document.getElementById("cp-user-email")) document.getElementById("cp-user-email").innerText = currentUser.email || "-";
    if (document.getElementById("cp-user-empid")) document.getElementById("cp-user-empid").innerText = currentUser.employeeId || currentUser.id || "-";
  }

  if (document.getElementById("cp-current-pass")) document.getElementById("cp-current-pass").value = "";
  if (document.getElementById("cp-new-pass")) document.getElementById("cp-new-pass").value = "";
  if (document.getElementById("cp-confirm-pass")) document.getElementById("cp-confirm-pass").value = "";

  modal.classList.add("active");
}

function closeChangePasswordModal() {
  const modal = document.getElementById("modal-change-password");
  if (modal) modal.classList.remove("active");
}

function togglePassVisibility(inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    iconEl.classList.remove("fa-eye");
    iconEl.classList.add("fa-eye-slash");
  } else {
    input.type = "password";
    iconEl.classList.remove("fa-eye-slash");
    iconEl.classList.add("fa-eye");
  }
}

function handleUserPasswordChange(event) {
  event.preventDefault();
  const currentPass = document.getElementById("cp-current-pass").value;
  const newPass = document.getElementById("cp-new-pass").value;
  const confirmPass = document.getElementById("cp-confirm-pass").value;

  if (newPass !== confirmPass) {
    showToast("New password and confirm password do not match!", "error");
    return;
  }

  if (newPass.length < 6) {
    showToast("Password must be at least 6 characters long.", "error");
    return;
  }

  // Find user in database
  const users = expenseDb.getTable("users") || [];
  const user = users.find(u => 
    (currentUser.id && u.id === currentUser.id) ||
    (currentUser.employeeId && u.employeeId === currentUser.employeeId) ||
    (currentUser.email && u.email === currentUser.email)
  );

  if (!user) {
    showToast("User account record not found.", "error");
    return;
  }

  // Verify current password if password exists
  if (user.password && user.password !== currentPass) {
    showToast("Current password entered is incorrect.", "error");
    return;
  }

  // Update password in database
  user.password = newPass;
  expenseDb.updateRecord("users", "id", user.id, user);

  // Update session
  currentUser.password = newPass;
  sessionStorage.setItem("EXPENSE_SESSION", JSON.stringify(currentUser));

  // Log audit event
  expenseDb.addLog(
    currentUser.employeeId || currentUser.id,
    currentUser.name,
    "Change Password",
    `User ${currentUser.name} successfully updated account login password.`
  );

  showToast("Password updated successfully!", "success");
  closeChangePasswordModal();
}

// ================= 10. ENTERPRISE SETTLEMENT DESK (FULL ADMIN ACCESS) =================

let adminCurrentSettlementPill = "open"; // "open" or "all"
let adminSettlementSearchFilter = "";
let adminSelectedSettlementEmployeeId = null;

function initAdminSettlementsPage() {
  const employees = expenseDb.getTable("employees") || [];
  const expenses = expenseDb.getTable("expenses") || [];
  const settlements = expenseDb.getTable("settlements") || [];
  const reimbursements = expenseDb.getTable("reimbursements") || [];
  const userCurrency = getUserCurrency();

  // Compute all employee ledgers
  let openBalanceSum = 0;
  let totalSettledSum = 0;
  let openAccountsCount = 0;
  let verifiedClaimsCount = 0;

  employees.forEach(emp => {
    const ledger = getAdminEmployeeSettlementLedger(emp.id);
    if (ledger.closingBalance > 0.01) {
      openBalanceSum += convertCurrency(ledger.closingBalance, ledger.currency, userCurrency);
      openAccountsCount++;
    }
  });

  expenses.forEach(e => {
    if (e.status === "FINANCE_APPROVED") {
      verifiedClaimsCount++;
    }
  });

  settlements.forEach(s => {
    totalSettledSum += convertCurrency(s.amount || 0, s.currency || "INR", userCurrency);
  });
  reimbursements.forEach(r => {
    if (!settlements.some(s => s.id === r.id || s.id === r.reportId || s.id === r.referenceNo)) {
      totalSettledSum += convertCurrency(r.amount || 0, r.currency || "INR", userCurrency);
    }
  });

  // Update KPI counters
  const kpiVer = document.getElementById("admin-settle-kpi-verified-count");
  const kpiOpen = document.getElementById("admin-settle-kpi-open-amount");
  const kpiSet = document.getElementById("admin-settle-kpi-settled-amount");
  const kpiAcc = document.getElementById("admin-settle-kpi-accounts-count");

  if (kpiVer) kpiVer.innerText = `${verifiedClaimsCount} Claim${verifiedClaimsCount !== 1 ? 's' : ''}`;
  if (kpiOpen) kpiOpen.innerText = formatAmount(openBalanceSum, userCurrency);
  if (kpiSet) kpiSet.innerText = formatAmount(totalSettledSum, userCurrency);
  if (kpiAcc) kpiAcc.innerText = `${openAccountsCount} Personnel`;

  // Update Pill badges
  const openCountEl = document.getElementById("admin-settle-open-count");
  const allCountEl = document.getElementById("admin-settle-all-count");
  if (openCountEl) openCountEl.innerText = openAccountsCount;
  if (allCountEl) allCountEl.innerText = employees.length;

  renderAdminSettlementEmployeeList();

  // Auto-select first employee if none selected
  if (!adminSelectedSettlementEmployeeId && employees.length > 0) {
    const firstOpen = employees.find(e => getAdminEmployeeSettlementLedger(e.id).closingBalance > 0.01);
    if (firstOpen) {
      selectAdminSettlementEmployee(firstOpen.id);
    } else {
      selectAdminSettlementEmployee(employees[0].id);
    }
  } else if (adminSelectedSettlementEmployeeId) {
    selectAdminSettlementEmployee(adminSelectedSettlementEmployeeId);
  }
}

function switchAdminSettlementPill(pillType) {
  adminCurrentSettlementPill = pillType;
  const pillOpen = document.getElementById("admin-pill-settle-open");
  const pillAll = document.getElementById("admin-pill-settle-all");

  if (pillOpen) pillOpen.classList.toggle("active", pillType === "open");
  if (pillAll) pillAll.classList.toggle("active", pillType === "all");

  renderAdminSettlementEmployeeList();
}

function filterAdminSettlementEmployees(query) {
  adminSettlementSearchFilter = (query || "").trim().toLowerCase();
  renderAdminSettlementEmployeeList();
}

function getAdminEmployeeSettlementLedger(empId) {
  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => e.id === empId || e.name === empId);
  const expenses = expenseDb.getTable("expenses") || [];
  const settlements = expenseDb.getTable("settlements") || [];
  const reimbursements = expenseDb.getTable("reimbursements") || [];

  const empExpenses = expenses.filter(e => 
    e.employeeId === empId || (emp && (e.employeeName === emp.name || e.employeeId === emp.name))
  );

  const empSettlements = settlements.filter(s => 
    s.employeeId === empId || (emp && (s.employeeName === emp.name || s.employeeId === emp.name))
  );

  const empReimbursements = reimbursements.filter(r => 
    r.employeeId === empId || (emp && (r.employeeName === emp.name || r.employeeId === emp.name))
  );

  // Determine primary currency for employee
  let primaryCurrency = "INR";
  if (emp && emp.country === "ID") primaryCurrency = "IDR";
  else if (emp && emp.country === "US") primaryCurrency = "USD";
  else if (emp && emp.country === "EU") primaryCurrency = "EUR";
  else if (empExpenses.length > 0 && empExpenses[0].currency) primaryCurrency = empExpenses[0].currency;

  const ledgerEntries = [];

  // Add all approved / submitted expenses as DEBITS (company owes employee)
  empExpenses.forEach(exp => {
    if (["FINANCE_APPROVED", "PAID", "SETTLED", "APPROVED"].includes(exp.status)) {
      ledgerEntries.push({
        id: exp.id,
        type: "EXPENSE_CLAIM",
        date: exp.date || exp.dateCreated || "2026-08-01",
        description: exp.description || `${exp.category} - ${exp.type}`,
        debit: parseFloat(exp.amount) || 0,
        credit: 0,
        status: exp.status,
        mode: exp.paymentMethod || "Direct Claim",
        notes: exp.remarks || `Claim for ${exp.type}`
      });
    }
  });

  // Add all settlements as CREDITS (company paid money to employee)
  empSettlements.forEach(st => {
    ledgerEntries.push({
      id: st.id,
      type: "SETTLEMENT_PAYOUT",
      date: st.dateCreated ? st.dateCreated.split(" ")[0] : (st.date || "2026-08-25"),
      description: `Settlement Payout (${st.mode})`,
      debit: 0,
      credit: parseFloat(st.amount) || 0,
      status: "SETTLED",
      mode: st.mode,
      notes: st.notes || "Settlement payout",
      settlementRecord: st
    });
  });

  empReimbursements.forEach(rm => {
    // Avoid double counting if already in settlements
    if (!empSettlements.some(st => st.id === rm.id || st.id === rm.reportId || st.id === rm.referenceNo || st.notes === rm.remarks)) {
      ledgerEntries.push({
        id: rm.id,
        type: "REIMBURSEMENT_PAID",
        date: rm.paymentDate || rm.paidDate || "2026-08-20",
        description: `Disbursement: ${rm.paymentMethod || "Bank Clearance"}`,
        debit: 0,
        credit: parseFloat(rm.amount) || 0,
        status: "PAID",
        mode: rm.paymentMethod || "Bank Transfer",
        notes: rm.remarks || "ERP Payout clearance"
      });
    }
  });

  // Sort chronologically
  ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Compute running closing balance
  let runningBalance = 0;
  let totalDebits = 0;
  let totalCredits = 0;

  ledgerEntries.forEach(item => {
    runningBalance += (item.debit - item.credit);
    totalDebits += item.debit;
    totalCredits += item.credit;
    item.closingBalance = runningBalance;
  });

  return {
    employee: emp,
    currency: primaryCurrency,
    totalDebits: totalDebits,
    totalCredits: totalCredits,
    closingBalance: runningBalance,
    entries: ledgerEntries
  };
}

function renderAdminSettlementEmployeeList() {
  const container = document.getElementById("admin-settlement-employee-list");
  if (!container) return;

  const employees = expenseDb.getTable("employees") || [];
  let filtered = employees;

  if (adminCurrentSettlementPill === "open") {
    filtered = filtered.filter(e => {
      const ledger = getAdminEmployeeSettlementLedger(e.id);
      return ledger.closingBalance > 0.01;
    });
  }

  if (adminSettlementSearchFilter) {
    filtered = filtered.filter(e => 
      (e.name && e.name.toLowerCase().includes(adminSettlementSearchFilter)) ||
      (e.id && e.id.toLowerCase().includes(adminSettlementSearchFilter)) ||
      (e.department && e.department.toLowerCase().includes(adminSettlementSearchFilter))
    );
  }

  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 15px; color: var(--text-muted); font-size: 12.5px;">
        <i class="fa-solid fa-user-check" style="font-size: 28px; color: #cbd5e1; margin-bottom: 10px; display: block;"></i>
        No ${adminCurrentSettlementPill === "open" ? 'open settlements' : 'personnel records found'}.
      </div>
    `;
    return;
  }

  const avatarStyles = ["", "alt-1", "alt-2", "alt-3", "alt-4"];

  filtered.forEach((emp, idx) => {
    const ledger = getAdminEmployeeSettlementLedger(emp.id);
    const initials = emp.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "EM";
    const avatarClass = avatarStyles[idx % avatarStyles.length];
    const isSelected = emp.id === adminSelectedSettlementEmployeeId;

    let balStr = "";
    let balClass = "zero";
    if (ledger.closingBalance > 0.01) {
      balStr = formatAmount(ledger.closingBalance, ledger.currency) + " Dr.";
      balClass = "dr";
    } else if (ledger.closingBalance < -0.01) {
      balStr = formatAmount(Math.abs(ledger.closingBalance), ledger.currency) + " Cr.";
      balClass = "cr";
    } else {
      balStr = formatAmount(0, ledger.currency);
      balClass = "zero";
    }

    const itemEl = document.createElement("div");
    itemEl.className = `settlement-emp-item ${isSelected ? 'active' : ''}`;
    itemEl.onclick = () => selectAdminSettlementEmployee(emp.id);
    itemEl.innerHTML = `
      <div class="settlement-emp-left">
        <div class="settlement-avatar ${avatarClass}">${initials}</div>
        <div>
          <div class="settlement-emp-name">${emp.name}</div>
          <div class="settlement-emp-role">${emp.designation || emp.department || 'Personnel'} · ${emp.id}</div>
        </div>
      </div>
      <div class="settlement-emp-balance ${balClass}">
        ${balStr}
      </div>
    `;
    container.appendChild(itemEl);
  });
}

function selectAdminSettlementEmployee(empId) {
  adminSelectedSettlementEmployeeId = empId;
  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => e.id === empId || e.name === empId);
  if (!emp) return;

  const ledger = getAdminEmployeeSettlementLedger(emp.id);
  const initials = emp.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "EM";

  // Update active state in left roster
  const allItems = document.querySelectorAll("#admin-settlement-employee-list .settlement-emp-item");
  allItems.forEach(item => item.classList.remove("active"));
  const clickedItem = Array.from(allItems).find(i => i.innerHTML.includes(emp.name));
  if (clickedItem) clickedItem.classList.add("active");

  // Update Detail Header
  const avatarEl = document.getElementById("admin-settle-detail-avatar");
  const nameEl = document.getElementById("admin-settle-detail-name");
  const metaEl = document.getElementById("admin-settle-detail-meta");

  if (avatarEl) avatarEl.innerText = initials;
  if (nameEl) nameEl.innerText = emp.name;
  if (metaEl) metaEl.innerText = `${emp.designation || 'Personnel'} | ${emp.department || 'Department'} | ID: ${emp.id} | Bank: ${emp.bankDetails || 'Direct Account'}`;

  // Show action & metric panels
  const btnPdf = document.getElementById("admin-btn-export-settle-pdf");
  const btnCsv = document.getElementById("admin-btn-export-settle-csv");
  const btnOpenModal = document.getElementById("admin-btn-open-settle-modal");
  const metricsGrid = document.getElementById("admin-settle-detail-metrics");
  const historySec = document.getElementById("admin-settle-detail-history-section");
  const emptyState = document.getElementById("admin-settle-empty-state");

  if (btnPdf) btnPdf.style.display = "inline-flex";
  if (btnCsv) btnCsv.style.display = "inline-flex";
  if (btnOpenModal) btnOpenModal.style.display = "inline-flex";
  if (metricsGrid) metricsGrid.style.display = "grid";
  if (historySec) historySec.style.display = "block";
  if (emptyState) emptyState.style.display = "none";

  // Update Summary Metrics
  const debitsEl = document.getElementById("admin-settle-total-debits");
  const creditsEl = document.getElementById("admin-settle-total-credits");
  const closingEl = document.getElementById("admin-settle-closing-balance");

  if (debitsEl) debitsEl.innerText = formatAmount(ledger.totalDebits, ledger.currency);
  if (creditsEl) creditsEl.innerText = formatAmount(ledger.totalCredits, ledger.currency);

  if (closingEl) {
    if (ledger.closingBalance > 0.01) {
      closingEl.innerText = formatAmount(ledger.closingBalance, ledger.currency) + " Dr.";
      closingEl.className = "settlement-metric-val closing-dr";
    } else if (ledger.closingBalance < -0.01) {
      closingEl.innerText = formatAmount(Math.abs(ledger.closingBalance), ledger.currency) + " Cr.";
      closingEl.className = "settlement-metric-val closing-cr";
    } else {
      closingEl.innerText = formatAmount(0, ledger.currency) + " (Settled)";
      closingEl.className = "settlement-metric-val";
    }
  }

  // Render History Table with Full Admin Actions (Edit & Delete)
  const tbody = document.getElementById("admin-settle-history-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (ledger.entries.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 30px;">No transaction records found for this employee.</td></tr>`;
  } else {
    const sortedEntries = [...ledger.entries].reverse();
    sortedEntries.forEach(entry => {
      const row = document.createElement("tr");
      const isClaim = entry.type === "EXPENSE_CLAIM";
      const isPayout = entry.type === "SETTLEMENT_PAYOUT" || entry.type === "REIMBURSEMENT_PAID";
      
      const badge = isClaim 
        ? `<span class="status-badge pending" style="font-size: 10.5px;"><i class="fa-solid fa-file-invoice"></i> Claim</span>` 
        : `<span class="status-badge approved" style="font-size: 10.5px;"><i class="fa-solid fa-money-bill-transfer"></i> Payout</span>`;

      const debitStr = entry.debit > 0 ? formatAmount(entry.debit, ledger.currency) : "-";
      const creditStr = entry.credit > 0 ? `<span style="color: #16a34a; font-weight: 600;">${formatAmount(entry.credit, ledger.currency)}</span>` : "-";
      const runningStr = entry.closingBalance >= 0 
        ? formatAmount(entry.closingBalance, ledger.currency) + " Dr." 
        : formatAmount(Math.abs(entry.closingBalance), ledger.currency) + " Cr.";

      let actionsHtml = "";
      if (isPayout) {
        actionsHtml = `
          <div class="d-flex gap-1 justify-center">
            <button class="btn btn-icon" title="Edit Settlement" onclick="openAdminEditSettlementModal('${entry.id}')" style="padding: 4px 8px; font-size: 12px; color: var(--primary);">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn btn-icon text-danger" title="Delete Settlement Record" onclick="deleteAdminSettlementRecord('${entry.id}')" style="padding: 4px 8px; font-size: 12px; color: #ef4444;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <div class="d-flex justify-center">
            <button class="btn btn-icon" title="View Transaction" onclick="openExpenseDetails('${entry.id}')" style="padding: 4px 8px; font-size: 12px; color: #64748b;">
              <i class="fa-solid fa-eye"></i>
            </button>
          </div>
        `;
      }

      row.innerHTML = `
        <td style="font-weight: 500;">${formatDate(entry.date)}</td>
        <td>${badge} <span style="font-size: 11px; color: var(--text-muted); margin-left: 4px;">${entry.id}</span></td>
        <td><span style="font-size: 11px; font-weight: 600; color: var(--text-dark);">${entry.type.replace('_', ' ')}</span></td>
        <td style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${entry.description} - ${entry.notes}">${entry.description} <span style="font-size: 11px; color: var(--text-muted);">(${entry.mode})</span></td>
        <td style="text-align: right; font-weight: 600;">${debitStr}</td>
        <td style="text-align: right;">${creditStr}</td>
        <td style="text-align: right; font-weight: 700; ${entry.closingBalance > 0 ? 'color: #dc2626;' : 'color: #16a34a;'}">${runningStr}</td>
        <td style="text-align: center;"><span class="status-badge ${entry.status === 'SETTLED' || entry.status === 'PAID' ? 'approved' : 'pending'}" style="font-size: 10px;">${entry.status}</span></td>
        <td style="text-align: center;">${actionsHtml}</td>
      `;
      tbody.appendChild(row);
    });
  }
}

function populateAdminSettlementEmployeeDropdown(selectedId) {
  const selectEl = document.getElementById("modal-admin-settle-emp-select");
  if (!selectEl) return;
  const employees = expenseDb.getTable("employees") || [];
  selectEl.innerHTML = "";

  employees.forEach(emp => {
    const ledger = getAdminEmployeeSettlementLedger(emp.id);
    let balText = " (Settled)";
    if (ledger.closingBalance > 0.01) {
      balText = ` (${formatAmount(ledger.closingBalance, ledger.currency)} Dr)`;
    } else if (ledger.closingBalance < -0.01) {
      balText = ` (${formatAmount(Math.abs(ledger.closingBalance), ledger.currency)} Cr)`;
    }

    const option = document.createElement("option");
    option.value = emp.id;
    option.innerText = `${emp.name} (${emp.id}) - ${emp.department || 'Staff'}${balText}`;
    if (emp.id === selectedId) option.selected = true;
    selectEl.appendChild(option);
  });
}

function onAdminSettlementEmployeeChange(empId) {
  adminSelectedSettlementEmployeeId = empId;
  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => e.id === empId || e.name === empId);
  if (!emp) return;

  const ledger = getAdminEmployeeSettlementLedger(emp.id);
  const balance = Math.max(0, ledger.closingBalance);

  const empNameEl = document.getElementById("modal-admin-settle-emp-name");
  if (empNameEl) empNameEl.innerText = `${emp.name} (${emp.id}) · ${emp.bankDetails || 'Bank Transfer'}`;

  const balDisplayEl = document.getElementById("modal-admin-settle-balance-display");
  if (balDisplayEl) balDisplayEl.value = formatAmount(balance, ledger.currency);

  const balValEl = document.getElementById("modal-admin-settle-balance-val");
  if (balValEl) balValEl.value = balance;

  const typeEl = document.getElementById("modal-admin-settle-type");
  if (typeEl) typeEl.value = ledger.closingBalance >= 0 ? "Dr" : "Cr";

  const amountEl = document.getElementById("modal-admin-settle-amount");
  if (amountEl) amountEl.value = balance > 0 ? balance.toFixed(2) : "0.00";

  const notesEl = document.getElementById("modal-admin-settle-notes");
  if (notesEl) notesEl.value = `Disbursed settlement payout for ${emp.name} - ${new Date().toLocaleDateString('en-GB')}`;

  // Keep list on the main view synced
  const allItems = document.querySelectorAll("#admin-settlement-employee-list .settlement-emp-item");
  allItems.forEach(item => item.classList.remove("active"));
  const clickedItem = Array.from(allItems).find(i => i.innerHTML.includes(emp.name));
  if (clickedItem) clickedItem.classList.add("active");
}

function openAdminAddSettlementModal() {
  const employees = expenseDb.getTable("employees") || [];
  if (employees.length === 0) {
    showToast("No personnel records found in database.", "warning");
    return;
  }

  let empIdToSelect = adminSelectedSettlementEmployeeId;
  if (!empIdToSelect || !employees.some(e => e.id === empIdToSelect)) {
    const firstWithBalance = employees.find(e => getAdminEmployeeSettlementLedger(e.id).closingBalance > 0.01);
    empIdToSelect = firstWithBalance ? firstWithBalance.id : employees[0].id;
  }

  populateAdminSettlementEmployeeDropdown(empIdToSelect);
  onAdminSettlementEmployeeChange(empIdToSelect);

  const modal = document.getElementById("modal-admin-add-settlement");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeAdminAddSettlementModal() {
  const modal = document.getElementById("modal-admin-add-settlement");
  if (modal) {
    modal.classList.remove("active");
  }
}

async function handleAdminSaveSettlement(event) {
  event.preventDefault();
  const selectEl = document.getElementById("modal-admin-settle-emp-select");
  const targetEmpId = selectEl ? selectEl.value : adminSelectedSettlementEmployeeId;

  if (!targetEmpId) {
    showToast("Please select an employee to settle.", "error");
    return;
  }

  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => e.id === targetEmpId || e.name === targetEmpId);
  if (!emp) {
    showToast("Selected employee record not found.", "error");
    return;
  }

  const ledger = getAdminEmployeeSettlementLedger(emp.id);
  const type = document.getElementById("modal-admin-settle-type").value;
  const mode = document.getElementById("modal-admin-settle-mode").value;
  const amount = parseFloat(document.getElementById("modal-admin-settle-amount").value || 0);
  const notes = document.getElementById("modal-admin-settle-notes").value.trim();

  if (amount <= 0) {
    showToast("Please enter a valid settlement amount greater than 0.", "error");
    return;
  }

  const settlementId = "SETTLE-" + Date.now().toString().slice(-6);
  const balanceBefore = ledger.closingBalance;
  const balanceAfter = Math.max(0, balanceBefore - amount);

  const settlementRecord = {
    id: settlementId,
    employeeId: emp.id,
    employeeName: emp.name,
    type: type,
    mode: mode,
    amount: amount,
    currency: ledger.currency,
    balanceBefore: balanceBefore,
    balanceAfter: balanceAfter,
    notes: notes,
    settledBy: currentUser ? (currentUser.name || currentUser.email) : "Administrator",
    dateCreated: new Date().toISOString().replace("T", " ").slice(0, 19)
  };

  // Add to local database bridge
  expenseDb.addRecord("settlements", settlementRecord);

  // Mark approved expenses for this employee as SETTLED
  const allExpenses = expenseDb.getTable("expenses") || [];
  allExpenses.forEach(exp => {
    if (exp.employeeId === emp.id && ["FINANCE_APPROVED", "APPROVED"].includes(exp.status)) {
      expenseDb.updateRecord("expenses", "id", exp.id, {
        status: "SETTLED",
        remarks: `Settled via ${settlementId} (${mode})`
      });
    }
  });

  // Also create reimbursement record for tracking views
  const reimRecord = {
    id: "REIM-" + Date.now().toString().slice(-6),
    reportId: settlementId,
    employeeId: emp.id,
    employeeName: emp.name,
    amount: amount,
    currency: ledger.currency,
    paymentMethod: mode,
    paidDate: new Date().toISOString().split("T")[0],
    referenceNo: settlementId,
    remarks: notes,
    status: "PAID"
  };
  expenseDb.addRecord("reimbursements", reimRecord);

  // Sync to backend API
  try {
    if (window.api && window.api.insert) {
      await window.api.insert("settlements", settlementRecord);
    }
  } catch (err) {
    console.warn("[Admin Settlement Sync Warning]:", err);
  }

  // Audit log
  expenseDb.addLog(
    currentUser ? currentUser.employeeId : "ADM001",
    currentUser ? currentUser.name : "Administrator",
    "Settlement Payout Recorded",
    `Admin recorded settlement payout of ${formatAmount(amount, ledger.currency)} to ${emp.name} via ${mode}. Ref: ${settlementId}`
  );

  closeAdminAddSettlementModal();
  showToast(`Settlement payout of ${formatAmount(amount, ledger.currency)} recorded successfully for ${emp.name}!`, "success");

  // Re-initialize page
  initAdminSettlementsPage();
  selectAdminSettlementEmployee(emp.id);
}

function openAdminEditSettlementModal(settlementId) {
  const settlements = expenseDb.getTable("settlements") || [];
  const st = settlements.find(s => s.id === settlementId);

  if (!st) {
    // Check if reimbursement record
    const reimbursements = expenseDb.getTable("reimbursements") || [];
    const rm = reimbursements.find(r => r.id === settlementId || r.reportId === settlementId || r.referenceNo === settlementId);
    if (rm) {
      document.getElementById("modal-admin-edit-settle-id").value = rm.id;
      document.getElementById("modal-admin-edit-settle-emp-name").innerText = rm.employeeName || "Employee";
      document.getElementById("modal-admin-edit-settle-emp-meta").innerText = `Disbursement Ref: ${rm.id}`;
      document.getElementById("modal-admin-edit-settle-type").value = "Dr";
      document.getElementById("modal-admin-edit-settle-mode").value = rm.paymentMethod || "Company Bank Transfer";
      document.getElementById("modal-admin-edit-settle-amount").value = rm.amount || 0;
      document.getElementById("modal-admin-edit-settle-date").value = rm.paidDate || new Date().toISOString().split("T")[0];
      document.getElementById("modal-admin-edit-settle-notes").value = rm.remarks || "";
      
      const modal = document.getElementById("modal-admin-edit-settlement");
      if (modal) modal.classList.add("active");
      return;
    }
    showToast("Settlement record not found.", "error");
    return;
  }

  document.getElementById("modal-admin-edit-settle-id").value = st.id;
  document.getElementById("modal-admin-edit-settle-emp-name").innerText = st.employeeName || "Personnel";
  document.getElementById("modal-admin-edit-settle-emp-meta").innerText = `Employee ID: ${st.employeeId || '-'} | Ref: ${st.id}`;
  document.getElementById("modal-admin-edit-settle-type").value = st.type || "Dr";
  document.getElementById("modal-admin-edit-settle-mode").value = st.mode || "Out of system (Bank Transfer / UPI)";
  document.getElementById("modal-admin-edit-settle-amount").value = st.amount || 0;
  document.getElementById("modal-admin-edit-settle-date").value = st.dateCreated ? st.dateCreated.split(" ")[0] : (st.date || new Date().toISOString().split("T")[0]);
  document.getElementById("modal-admin-edit-settle-notes").value = st.notes || "";

  const modal = document.getElementById("modal-admin-edit-settlement");
  if (modal) {
    modal.classList.add("active");
  }
}

function closeAdminEditSettlementModal() {
  const modal = document.getElementById("modal-admin-edit-settlement");
  if (modal) {
    modal.classList.remove("active");
  }
}

async function handleAdminUpdateSettlement(event) {
  event.preventDefault();
  const settleId = document.getElementById("modal-admin-edit-settle-id").value;
  if (!settleId) return;

  const type = document.getElementById("modal-admin-edit-settle-type").value;
  const mode = document.getElementById("modal-admin-edit-settle-mode").value;
  const amount = parseFloat(document.getElementById("modal-admin-edit-settle-amount").value || 0);
  const date = document.getElementById("modal-admin-edit-settle-date").value;
  const notes = document.getElementById("modal-admin-edit-settle-notes").value.trim();

  if (amount <= 0) {
    showToast("Amount must be greater than zero.", "error");
    return;
  }

  const settlements = expenseDb.getTable("settlements") || [];
  const st = settlements.find(s => s.id === settleId);

  if (st) {
    st.type = type;
    st.mode = mode;
    st.amount = amount;
    st.dateCreated = `${date} 12:00:00`;
    st.notes = notes;
    st.lastModifiedBy = currentUser ? currentUser.name : "Administrator";

    expenseDb.updateRecord("settlements", "id", st.id, st);

    // Sync matching reimbursement record if exists
    const reimbursements = expenseDb.getTable("reimbursements") || [];
    const rm = reimbursements.find(r => r.reportId === settleId || r.referenceNo === settleId || r.id === settleId);
    if (rm) {
      rm.amount = amount;
      rm.paymentMethod = mode;
      rm.paidDate = date;
      rm.remarks = notes;
      expenseDb.updateRecord("reimbursements", "id", rm.id, rm);
    }

    try {
      if (window.api && window.api.update) {
        await window.api.update("settlements", st.id, st);
      }
    } catch (err) {
      console.warn("[Settlement Update Warning]:", err);
    }
  } else {
    // Update reimbursement record directly
    const reimbursements = expenseDb.getTable("reimbursements") || [];
    const rm = reimbursements.find(r => r.id === settleId);
    if (rm) {
      rm.amount = amount;
      rm.paymentMethod = mode;
      rm.paidDate = date;
      rm.remarks = notes;
      expenseDb.updateRecord("reimbursements", "id", rm.id, rm);
    }
  }

  expenseDb.addLog(
    currentUser ? currentUser.employeeId : "ADM001",
    currentUser ? currentUser.name : "Administrator",
    "Settlement Record Updated",
    `Admin modified settlement payout ${settleId}: new amount ${amount}, mode ${mode}.`
  );

  closeAdminEditSettlementModal();
  showToast("Settlement record updated successfully.", "success");

  initAdminSettlementsPage();
  if (adminSelectedSettlementEmployeeId) {
    selectAdminSettlementEmployee(adminSelectedSettlementEmployeeId);
  }
}

async function deleteAdminSettlementRecord(settlementId) {
  if (!confirm(`Are you sure you want to delete settlement payout record ${settlementId}? This will revert cleared balances and recalculate the employee ledger.`)) {
    return;
  }

  const settlements = expenseDb.getTable("settlements") || [];
  const st = settlements.find(s => s.id === settlementId);

  // Remove from settlements table
  expenseDb.deleteRecord("settlements", "id", settlementId);

  // Remove matching reimbursement record if exists
  const reimbursements = expenseDb.getTable("reimbursements") || [];
  const rm = reimbursements.find(r => r.id === settlementId || r.reportId === settlementId || r.referenceNo === settlementId);
  if (rm) {
    expenseDb.deleteRecord("reimbursements", "id", rm.id);
  }

  // Re-check employee expenses: if any were marked SETTLED via this payout, revert to FINANCE_APPROVED
  if (st && st.employeeId) {
    const expenses = expenseDb.getTable("expenses") || [];
    expenses.forEach(exp => {
      if (exp.employeeId === st.employeeId && exp.status === "SETTLED") {
        if (exp.remarks && exp.remarks.includes(settlementId)) {
          expenseDb.updateRecord("expenses", "id", exp.id, {
            status: "FINANCE_APPROVED",
            remarks: "Reverted to Finance Approved following settlement deletion"
          });
        }
      }
    });
  }

  // Sync to API
  try {
    if (window.api && window.api.delete) {
      await window.api.delete("settlements", settlementId);
    }
  } catch (err) {
    console.warn("[Settlement Delete Warning]:", err);
  }

  // Audit log
  expenseDb.addLog(
    currentUser ? currentUser.employeeId : "ADM001",
    currentUser ? currentUser.name : "Administrator",
    "Settlement Payout Deleted",
    `Admin deleted settlement payout record ${settlementId} and refreshed transaction ledger.`
  );

  showToast(`Settlement record ${settlementId} deleted successfully.`, "success");

  initAdminSettlementsPage();
  if (adminSelectedSettlementEmployeeId) {
    selectAdminSettlementEmployee(adminSelectedSettlementEmployeeId);
  }
}

function exportAdminSettlement(format) {
  if (!adminSelectedSettlementEmployeeId) {
    showToast("Please select an employee first to export ledger statement.", "warning");
    return;
  }

  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => e.id === adminSelectedSettlementEmployeeId);
  if (!emp) return;

  const ledger = getAdminEmployeeSettlementLedger(emp.id);
  const today = new Date().toISOString().split("T")[0];

  if (format === "pdf") {
    const headers = ["Date", "Voucher ID", "Transaction Type", "Description / Mode", "Debit (Claim)", "Credit (Paid)", "Running Balance", "Status"];
    const rows = ledger.entries.map(e => [
      formatDate(e.date),
      e.id || "",
      (e.type || "").replace('_', ' '),
      `${e.description || ''} ${e.mode ? '(' + e.mode + ')' : ''}`,
      e.debit > 0 ? formatAmount(e.debit, ledger.currency) : "-",
      e.credit > 0 ? formatAmount(e.credit, ledger.currency) : "-",
      e.closingBalance >= 0 ? `${formatAmount(e.closingBalance, ledger.currency)} Dr.` : `${formatAmount(Math.abs(e.closingBalance), ledger.currency)} Cr.`,
      e.status || ""
    ]);

    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });

      // Header Banner
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("EXPENSE ERP - Personnel Settlement & Account Statement", 14, 14);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${today} | Administrator Statement`, doc.internal.pageSize.getWidth() - 14, 14, { align: "right" });

      // Personnel Details Box
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`Employee: ${emp.name} (${emp.id})`, 14, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.text(`Department: ${emp.department || 'General'} | Designation: ${emp.designation || 'Staff'} | Bank Account: ${emp.bankDetails || 'Direct Account'}`, 14, 35);
      
      const balStr = ledger.closingBalance >= 0 ? `${formatAmount(ledger.closingBalance, ledger.currency)} Dr.` : `${formatAmount(Math.abs(ledger.closingBalance), ledger.currency)} Cr.`;
      doc.setFont("helvetica", "bold");
      doc.text(`Total Debits: ${formatAmount(ledger.totalDebits, ledger.currency)}   |   Total Credits: ${formatAmount(ledger.totalCredits, ledger.currency)}   |   Closing Balance: ${balStr}`, 14, 41);

      doc.autoTable({
        startY: 46,
        head: [headers],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [67, 56, 202], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 46, left: 10, right: 10, bottom: 10 }
      });

      doc.save(`Settlement_Statement_${emp.id}_${today}.pdf`);
      showToast(`Exported settlement statement for ${emp.name} as PDF.`, "success");
    } else {
      printTableDirectly(`Settlement Statement - ${emp.name} (${emp.id})`, headers, rows);
      showToast("Opening printable statement preview...", "success");
    }
  } else if (format === "csv") {
    let csv = "Date,Voucher ID,Type,Description,Mode,Debit,Credit,Running Balance,Status,Notes\n";
    ledger.entries.forEach(e => {
      csv += `"${formatDate(e.date)}","${e.id}","${e.type}","${(e.description || '').replace(/"/g, '""')}","${e.mode || ''}",${e.debit},${e.credit},${e.closingBalance},"${e.status}","${(e.notes || '').replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Settlement_Statement_${emp.id}_${today}.csv`;
    link.click();
    showToast(`Exported settlement statement for ${emp.name} as CSV.`, "success");
  }
}

