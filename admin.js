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
  const sections = ["dashboard", "reports", "employees", "settings", "masters", "my-expenses", "add-expense", "approvals", "reimbursement"];
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
    "reimbursement": "Reimbursement Payments Tracking"
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
  }
}

function refreshUI() {
  refreshKPIs();
  renderRecentExpenses();
  renderCharts();
}

function formatIDR(value) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(value);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Refresh KPI values
function refreshKPIs() {
  const expenses = expenseDb.getTable("expenses");
  
  let approvedSum = 0;
  let pendingSum = 0;
  let rejectedSum = 0;
  
  expenses.forEach(e => {
    if (e.status === "APPROVED" || e.status === "FINANCE_APPROVED" || e.status === "PAID" || e.status === "REIMBURSEMENT_PENDING") {
      approvedSum += e.amount;
    } else if (e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "PENDING_FINANCE") {
      pendingSum += e.amount;
    } else if (e.status === "MANAGER_REJECTED" || e.status === "FINANCE_REJECTED") {
      rejectedSum += e.amount;
    }
  });

  const totalSum = approvedSum + pendingSum + rejectedSum;

  document.getElementById("kpi-total").innerText = formatIDR(totalSum);
  document.getElementById("kpi-approved").innerText = formatIDR(approvedSum);
  document.getElementById("kpi-pending").innerText = formatIDR(pendingSum);
  document.getElementById("kpi-rejected").innerText = formatIDR(rejectedSum);
}

// Render Recent Expenses table on main dashboard
function renderRecentExpenses() {
  const expenses = expenseDb.getTable("expenses");
  const sorted = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  
  const container = document.getElementById("dashboard-recent-expenses");
  container.innerHTML = "";

  if (sorted.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No recent expenses logged.</td></tr>`;
    return;
  }

  sorted.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${e.employeeName}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600;">${formatIDR(e.amount)}</td>
      <td>${formatDate(e.date)}</td>
      <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
    `;
    container.appendChild(row);
  });
}

// ================= CHART RENDERING =================

function renderCharts() {
  const expenses = expenseDb.getTable("expenses");
  
  // 1. Monthly chart
  const selectedYear = document.getElementById("dashboard-year-select").value || "2026";
  const monthlyData = Array(6).fill(0);
  
  expenses.forEach(e => {
    const expDate = new Date(e.date);
    if (expDate.getFullYear().toString() === selectedYear) {
      const month = expDate.getMonth();
      if (month >= 0 && month <= 5 && e.status !== "DRAFT") {
        monthlyData[month] += e.amount;
      }
    }
  });

  const ctxMonthly = document.getElementById("chart-monthly").getContext("2d");
  
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
      plugins: { legend: { display: false } },
      scales: {
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            callback: value => 'Rp ' + (value / 1000000) + 'M',
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
  const rosterBody = document.getElementById("admin-employee-table-body");
  rosterBody.innerHTML = "";
  
  emps.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700;">${e.id}</td>
      <td style="font-weight: 600; color: var(--text-dark);">${e.name}</td>
      <td>${e.email}</td>
      <td>${e.country}</td>
      <td>${e.department}</td>
      <td>${e.manager}</td>
      <td>${e.grade}</td>
      <td><code style="background-color: var(--border-color); padding: 2px 4px; border-radius: 4px;">${e.costCenter}</code></td>
      <td><span class="status-badge" style="background-color: var(--approved-bg); color: var(--approved-color)">Active</span></td>
    `;
    rosterBody.appendChild(row);
  });

  // Permissions matrix
  const perms = expenseDb.getTable("permissions");
  const permBody = document.getElementById("admin-permissions-table-body");
  permBody.innerHTML = "";
  
  perms.forEach(p => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${p.role}</td>
      <td>${p.userSetup ? '✅' : '❌'}</td>
      <td>${p.addExpense ? '✅' : '❌'}</td>
      <td>${p.approveExpense ? '✅' : '❌'}</td>
      <td>${p.financeVerify ? '✅' : '❌'}</td>
      <td>${p.reports === true ? '✅ All' : p.reports === 'Own' ? '👤 Own' : '❌'}</td>
      <td>${p.systemSetup ? '✅' : '❌'}</td>
    `;
    permBody.appendChild(row);
  });
}

function switchAdminTab(paneId) {
  document.querySelectorAll("#view-employees .admin-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

  document.querySelectorAll("#view-employees .tab-pane").forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });
}

function openEmployeeModal() {
  if (currentUser.role === "Auditor") return;
  document.getElementById("employee-modal-overlay").classList.add("active");
}

function closeEmployeeModal() {
  document.getElementById("employee-modal-overlay").classList.remove("active");
}

function handleEmployeeCreate(event) {
  event.preventDefault();
  if (currentUser.role === "Auditor") return;

  const idVal = document.getElementById("admin-emp-id").value;
  const nameVal = document.getElementById("admin-emp-name").value;
  const emailVal = document.getElementById("admin-emp-email").value;
  const desgVal = document.getElementById("admin-emp-desg").value;
  const countryVal = document.getElementById("admin-emp-country").value;
  const projVal = document.getElementById("admin-emp-project").value;
  const deptVal = document.getElementById("admin-emp-dept").value;
  const managerVal = document.getElementById("admin-emp-manager").value;
  const gradeVal = document.getElementById("admin-emp-grade").value;
  const ccVal = document.getElementById("admin-emp-cc").value;
  const statusVal = document.getElementById("admin-emp-status").value;

  const newEmp = {
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

  expenseDb.addRecord("employees", newEmp);

  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Add Employee", `Registered new employee master ${nameVal} (${idVal})`);
  showToast("Employee Master saved successfully!", "success");
  closeEmployeeModal();
  
  // Refresh views
  renderEmployeesTables();
  if (activeTab === "masters") {
    renderEmployeeMaster();
  }
}

// ================= CONFIGURATIONS & SETTINGS PANEL =================

function renderSettingsTab() {
  // Load Cost Centers
  const ccList = document.getElementById("cc-settings-list");
  ccList.innerHTML = "";
  expenseDb.getTable("costCenters").forEach(cc => {
    ccList.innerHTML += `
      <li class="d-flex justify-between align-center" style="font-size:12px; border-bottom:1px solid var(--border-color); padding-bottom: 6px;">
        <span><strong>${cc.code}</strong> - ${cc.name.replace(cc.code + " - ", "")}</span>
        <span class="status-badge" style="background-color: var(--approved-bg); color: var(--approved-color); font-size:9px;">Active</span>
      </li>
    `;
  });

  // Load Currencies
  const currList = document.getElementById("currency-settings-list");
  currList.innerHTML = "";
  expenseDb.getTable("currencies").forEach(c => {
    currList.innerHTML += `
      <li class="d-flex justify-between align-center" style="font-size:12px; border-bottom:1px solid var(--border-color); padding-bottom: 6px;">
        <span><strong>${c.code}</strong> (${c.symbol}) - ${c.name}</span>
        <span class="status-badge" style="background-color: var(--approved-bg); color: var(--approved-color); font-size:9px;">Active</span>
      </li>
    `;
  });

  // Load Policies
  renderPoliciesTable();
}

function renderPoliciesTable() {
  const policies = expenseDb.getTable("expensePolicies");
  const body = document.getElementById("settings-policies-table-body");
  body.innerHTML = "";

  policies.forEach(p => {
    const row = document.createElement("tr");
    
    let actionsHtml = currentUser.role !== "Auditor" ? `
      <button class="btn btn-danger btn-sm" onclick="deletePolicy('${p.id}')">Delete</button>
    ` : `<span style="color:var(--text-muted); font-size:11px;">Locked</span>`;

    row.innerHTML = `
      <td style="font-weight:700;">${p.id}</td>
      <td style="font-weight:600; color:var(--primary);">${p.type}</td>
      <td><strong>${formatIDR(p.limit)}</strong></td>
      <td>${p.currency}</td>
      <td>${p.scope}</td>
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

function deletePolicy(policyId) {
  if (currentUser.role === "Auditor") return;

  if (confirm(`Delete policy rule ${policyId}?`)) {
    expenseDb.deleteRecord("expensePolicies", "id", policyId);
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Delete Policy", `Removed spending limit config ${policyId}`);
    showToast("Spending policy deleted.", "success");
    renderPoliciesTable();
  }
}

function switchSettingsTab(paneId) {
  document.querySelectorAll("#view-settings .admin-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

  document.querySelectorAll("#view-settings .tab-pane").forEach(pane => {
    if (pane.id === paneId) {
      pane.classList.add("active");
    } else {
      pane.classList.remove("active");
    }
  });
}

function openPolicyModal() {
  if (currentUser.role === "Auditor") return;
  document.getElementById("policy-modal-overlay").classList.add("active");
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
  
  if (format === "json") {
    const jsonStr = JSON.stringify(expenses, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Expense_ERP_Ledger_${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    showToast("Exported database ledger as JSON file.", "success");
  } else {
    let csv = "Expense ID,Date,Employee,Project,Department,Category,Type,Amount,Currency,Payment Method,Status\n";
    expenses.forEach(e => {
      csv += `"${e.id}","${e.date}","${e.employeeName}","${e.project}","${e.department}","${e.category}","${e.type}",${e.amount},"${e.currency}","${e.paymentMethod}","${e.status}"\n`;
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Expense_ERP_Ledger_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    showToast("Exported database ledger as CSV file.", "success");
  }
  
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Data Export", `Exported transaction ledger in ${format.toUpperCase()} format.`);
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
  window.location.href = "login.html";
}

// ================= MASTER SETUP CRUD =================

let activeMasterTab = "country";

function switchMasterTab(paneId) {
  activeMasterTab = paneId.replace("m-tab-", "");
  
  // Toggle subtabs
  document.querySelectorAll("#view-masters .admin-tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });
  event.currentTarget.classList.add("active");

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
  renderMasterTable(activeMasterTab);
}

function renderMasterTable(type, filteredRecords = null) {
  if (type === "country") renderCountryMaster(filteredRecords);
  else if (type === "project") renderProjectMaster(filteredRecords);
  else if (type === "department") renderDepartmentMaster(filteredRecords);
  else if (type === "employee") renderEmployeeMaster(filteredRecords);
  else if (type === "user") renderUserMaster(filteredRecords);
  else if (type === "role") renderRoleMaster(filteredRecords);
  else if (type === "category") renderCategoryMaster(filteredRecords);
}

function renderCountryMaster(records = null) {
  if (!records) records = expenseDb.getTable("countries");
  const tbody = document.getElementById("tbl-m-country");
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

function renderEmployeeMaster(records = null) {
  if (!records) records = expenseDb.getTable("employees");
  const tbody = document.getElementById("tbl-m-employee");
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.id}</strong></td>
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td>${r.country}</td>
      <td>${r.project}</td>
      <td>${r.department}</td>
      <td>${r.designation}</td>
      <td><code>${r.costCenter}</code></td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('employees', 'id', '${r.id}', renderEmployeeMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderUserMaster(records = null) {
  if (!records) records = expenseDb.getTable("users");
  const tbody = document.getElementById("tbl-m-user");
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.id}</strong></td>
      <td>${r.employeeId}</td>
      <td>${r.name}</td>
      <td>${r.email}</td>
      <td><span class="status-badge approved">${r.role}</span></td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('users', 'id', '${r.id}', renderUserMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderRoleMaster(records = null) {
  if (!records) records = expenseDb.getTable("roles");
  const tbody = document.getElementById("tbl-m-role");
  tbody.innerHTML = "";
  records.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${r.name}</strong></td>
      <td>${r.desc}</td>
      <td><span class="status-badge ${r.status === 'Active' ? 'approved' : 'draft'}">${r.status}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteMasterRecord('roles', 'name', '${r.name}', renderRoleMaster)" ${currentUser.role === 'Auditor' ? 'disabled style="opacity:0.5;"' : ''}>Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderCategoryMaster(records = null) {
  if (!records) records = expenseDb.getTable("expenseCategories");
  const tbody = document.getElementById("tbl-m-category");
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
  else if (type === "employee") dbTable = "employees";
  else if (type === "user") dbTable = "users";
  else if (type === "role") dbTable = "roles";
  else if (type === "category") dbTable = "expenseCategories";

  const records = expenseDb.getTable(dbTable);
  const filtered = records.filter(r => {
    return Object.values(r).some(val => 
      String(val).toLowerCase().includes(query.toLowerCase())
    );
  });

  renderMasterTable(type, filtered);
}

// Open modal setups and dynamic selections
function openMasterModal(type) {
  if (currentUser.role === "Auditor") return;

  const modal = document.getElementById(type === "employee" ? "employee-modal-overlay" : `modal-m-${type}`);
  if (!modal) return;

  // Clear modal inputs
  const form = modal.querySelector("form");
  if (form) form.reset();

  // Populate relational values
  if (type === "country") {
    const currSelect = document.getElementById("m-country-currency");
    currSelect.innerHTML = "";
    expenseDb.getTable("currencies").forEach(c => {
      currSelect.innerHTML += `<option value="${c.code}">${c.name} (${c.code})</option>`;
    });
  } else if (type === "project") {
    const cSelect = document.getElementById("m-proj-country");
    cSelect.innerHTML = "";
    expenseDb.getTable("countries").forEach(c => {
      cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });

    const mSelect = document.getElementById("m-proj-manager");
    mSelect.innerHTML = "";
    expenseDb.getTable("employees").forEach(e => {
      mSelect.innerHTML += `<option value="${e.name}">${e.name} (${e.id})</option>`;
    });
  } else if (type === "department") {
    const mSelect = document.getElementById("m-dept-manager");
    mSelect.innerHTML = "";
    expenseDb.getTable("employees").forEach(e => {
      mSelect.innerHTML += `<option value="${e.name}">${e.name} (${e.id})</option>`;
    });
  } else if (type === "employee") {
    const cSelect = document.getElementById("admin-emp-country");
    cSelect.innerHTML = "";
    expenseDb.getTable("countries").forEach(c => {
      cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
    });

    const pSelect = document.getElementById("admin-emp-project");
    pSelect.innerHTML = "";
    expenseDb.getTable("projects").forEach(p => {
      pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
    });

    const dSelect = document.getElementById("admin-emp-dept");
    dSelect.innerHTML = "";
    expenseDb.getTable("departments").forEach(d => {
      dSelect.innerHTML += `<option value="${d.code}">${d.name}</option>`;
    });

    const mSelect = document.getElementById("admin-emp-manager");
    mSelect.innerHTML = "";
    expenseDb.getTable("employees").forEach(e => {
      mSelect.innerHTML += `<option value="${e.name}">${e.name}</option>`;
    });

    const gSelect = document.getElementById("admin-emp-grade");
    gSelect.innerHTML = "";
    expenseDb.getTable("employeeGrades").forEach(g => {
      gSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`;
    });

    const ccSelect = document.getElementById("admin-emp-cc");
    ccSelect.innerHTML = "";
    expenseDb.getTable("costCenters").forEach(cc => {
      ccSelect.innerHTML += `<option value="${cc.code}">${cc.name}</option>`;
    });
  } else if (type === "user") {
    const eSelect = document.getElementById("m-user-employee");
    eSelect.innerHTML = `<option value="">Select Employee</option>`;
    expenseDb.getTable("employees").forEach(e => {
      eSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`;
    });

    const rSelect = document.getElementById("m-user-role");
    rSelect.innerHTML = "";
    expenseDb.getTable("roles").forEach(r => {
      rSelect.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });
  }

  modal.classList.add("active");
}

function closeMasterModal(type) {
  const modal = document.getElementById(type === "employee" ? "employee-modal-overlay" : `modal-m-${type}`);
  if (modal) modal.classList.remove("active");
}

function autoFillUserFields() {
  const empId = document.getElementById("m-user-employee").value;
  if (!empId) return;

  const emp = expenseDb.getTable("employees").find(e => e.id === empId);
  if (emp) {
    document.getElementById("m-user-name").value = emp.name.toLowerCase().replace(/\s+/g, "_");
    document.getElementById("m-user-email").value = emp.email;
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
  } else if (type === "department") {
    const code = document.getElementById("m-dept-code").value.trim().toUpperCase();
    const name = document.getElementById("m-dept-name").value.trim();
    const manager = document.getElementById("m-dept-manager").value;
    const status = document.getElementById("m-dept-status").value;

    newRecord = { code, name, manager, status };
    tblKey = "departments";
    logAction = "Add Department Master";
  } else if (type === "user") {
    const employeeId = document.getElementById("m-user-employee").value;
    const name = document.getElementById("m-user-name").value.trim();
    const email = document.getElementById("m-user-email").value.trim();
    const role = document.getElementById("m-user-role").value;
    const password = document.getElementById("m-user-pass").value;
    const status = document.getElementById("m-user-status").value;

    newRecord = {
      id: "USR0" + (expenseDb.getTable("users").length + 1),
      employeeId,
      name,
      email,
      role,
      password,
      status
    };
    tblKey = "users";
    logAction = "Add User Account Master";
  } else if (type === "role") {
    const name = document.getElementById("m-role-name").value.trim();
    const desc = document.getElementById("m-role-desc").value.trim();
    const status = document.getElementById("m-role-status").value;

    newRecord = { name, desc, status };
    tblKey = "roles";
    logAction = "Add Role Master";
  } else if (type === "category") {
    const code = document.getElementById("m-cat-code").value.trim().toUpperCase();
    const name = document.getElementById("m-cat-name").value.trim();
    const icon = document.getElementById("m-cat-icon").value;
    const status = document.getElementById("m-cat-status").value;

    newRecord = { code, name, icon, status };
    tblKey = "expenseCategories";
    logAction = "Add Category Master";
  }

  // Save record
  expenseDb.addRecord(tblKey, newRecord);
  expenseDb.addLog(currentUser.employeeId, currentUser.name, logAction, `Saved core master entry details.`);
  showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} Master updated successfully!`, "success");
  
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
    empSelect.innerHTML += `<option value="${emp.employeeId}">${emp.name}</option>`;
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
  const emp = expenseDb.getTable("employees").find(e => e.employeeId === empId);
  if (!emp) return;

  const date = document.getElementById("adm-form-date").value;
  const country = document.getElementById("adm-form-country").value;
  const project = document.getElementById("adm-form-project").value;
  const dept = document.getElementById("adm-form-dept").value;
  const category = document.getElementById("adm-form-cat").value;
  const amount = parseFloat(document.getElementById("adm-form-amount").value);
  const method = document.getElementById("adm-form-method").value;
  const remarks = document.getElementById("adm-form-remarks").value.trim();

  // Create new claim entry directly into PENDING_MANAGER (or APPROVED if they bypass)
  const newId = "EXP" + String(expenseDb.getTable("expenses").length + 1).padStart(3, "0");
  const newExp = {
    id: newId,
    employeeId: emp.employeeId,
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
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Submit Expense (Admin)", `Logged claim request ${newId} for ${emp.name}.`);

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

  const sorted = [...records].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  sorted.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--text-muted);">${r.id}</td>
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${r.expenseId}')">${r.expenseId}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td style="font-weight: 600;">${formatIDR(r.amount)}</td>
      <td>${r.paymentMethod}</td>
      <td>${formatDate(r.paymentDate)}</td>
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
