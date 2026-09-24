// Manager Dashboard Controller Logic

// Get current session
const sessionData = sessionStorage.getItem("EXPENSE_SESSION");
const currentUser = JSON.parse(sessionData);

let activeTab = "team-dashboard";
let pendingActionExpenseId = null;
let pendingActionType = ""; // "reject", "clarification"
let editingDraftId = null;
let charts = {};

document.addEventListener("DOMContentLoaded", () => {
  initManagerPortal();
});

function initManagerPortal() {
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

  navigateToTab("team-dashboard");
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
  const sections = ["team-dashboard", "approvals", "approval-history", "my-dashboard", "add-expense", "expense-reports", "my-expenses", "settlements"];
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

  // Update headers
  const titles = {
    "team-dashboard": "Team Expense Dashboard",
    "approvals": "Pending Team Approvals",
    "approval-history": "Manager Decision History",
    "my-dashboard": "My Expense Dashboard",
    "add-expense": "Create Expense Claim",
    "expense-reports": "Expense Reports Desk",
    "my-expenses": "My Expense History",
    "settlements": "My Settlements & Reimbursements"
  };
  document.getElementById("page-title").innerText = titles[tabName] || "Manager Dashboard";
  
  if (tabName === "team-dashboard") {
    initManagerDashboard();
  } else if (tabName === "approvals") {
    renderManagerPendingReports();
    renderManagerApprovals();
  } else if (tabName === "approval-history") {
    renderManagerHistory();
  } else if (tabName === "my-dashboard") {
    refreshDashboard();
  } else if (tabName === "add-expense") {
    setupAddExpenseForm();
  } else if (tabName === "expense-reports") {
    initExpenseReportsPage();
  } else if (tabName === "my-expenses") {
    renderMyExpensesTable();
  } else if (tabName === "settlements") {
    initEmployeeSettlements();
  }
}

function refreshUI() {
  renderManagerPendingReports();
  renderManagerApprovals();
}

const EXCHANGE_RATES = {
  IDR: 1.0,
  INR: 175.0, // 1 INR = 175 IDR
  USD: 15000.0, // 1 USD = 15000 IDR
  EUR: 16500.0 // 1 EUR = 16500 IDR
};

function getUserCountry() {
  if (!currentUser) return "ID";
  if (currentUser.country) return currentUser.country;
  const employees = expenseDb.getTable("employees") || [];
  const emp = employees.find(e => 
    (currentUser.employeeId && e.id === currentUser.employeeId) ||
    (currentUser.id && e.id === currentUser.id) ||
    (currentUser.email && e.email === currentUser.email) ||
    (currentUser.name && e.name === currentUser.name)
  );
  if (emp && emp.country) return emp.country;
  return "ID";
}

function getUserCurrency() {
  const countryCode = getUserCountry();
  const countries = expenseDb.getTable("countries") || [];
  const countryObj = countries.find(c => 
    (c.code && c.code.toUpperCase() === countryCode.toUpperCase()) ||
    (c.name && c.name.toLowerCase() === countryCode.toLowerCase())
  );
  if (countryObj && countryObj.currency) return countryObj.currency;
  if (countryCode.length === 3) return countryCode.toUpperCase();
  const map = { "US": "USD", "ID": "IDR", "IN": "INR", "DE": "EUR", "SG": "SGD", "GB": "GBP" };
  return map[countryCode.toUpperCase()] || "IDR";
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

function formatAmount(amount, currency = null) {
  const code = currency || getUserCurrency();
  const currencies = expenseDb.getTable("currencies") || [];
  const currencyObj = currencies.find(c => c.code.toUpperCase() === code.toUpperCase());
  const symbol = currencyObj ? currencyObj.symbol : (code === "IDR" ? "Rp" : code === "USD" ? "$" : code === "EUR" ? "€" : code === "INR" ? "₹" : code);
  const decimals = currencyObj && currencyObj.decimalPlaces !== undefined ? currencyObj.decimalPlaces : (code === "IDR" ? 0 : 2);
  
  if (code === "IDR") {
    return symbol + " " + new Intl.NumberFormat("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
  } else {
    return symbol + " " + new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(amount);
  }
}

function formatIDR(value) {
  return formatAmount(value, getUserCurrency());
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Populate approvals list and calculate team KPIs
function renderManagerApprovals() {
  const expenses = expenseDb.getTable("expenses");
  
  // Pending individual team expenses for manager approval (exclude items already inside a folder)
  const teamExpenses = expenses.filter(e => e.status === "PENDING_MANAGER" && !e.reportId);
  
  // Set up project dropdown filtering
  const filterProj = document.getElementById("approval-filter-project");
  const currentVal = filterProj ? (filterProj.value || "All") : "All";
  const activeProjects = [...new Set(teamExpenses.map(t => t.project))];
  
  if (filterProj) {
    filterProj.innerHTML = `<option value="All">All Projects</option>`;
    activeProjects.forEach(p => {
      filterProj.innerHTML += `<option value="${p}">${p}</option>`;
    });
    filterProj.value = currentVal;
  }

  const filtered = currentVal === "All" ? teamExpenses : teamExpenses.filter(t => t.project === currentVal);
  const userCurrency = getUserCurrency();

  // Recalculate KPIs
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let totalOutstanding = 0;

  filtered.forEach(e => {
    const amountInUserCurrency = convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    if (e.status === "PENDING_MANAGER") {
      pendingCount++;
      totalOutstanding += amountInUserCurrency;
    } else if (e.status === "APPROVED" || e.status === "FINANCE_APPROVED" || e.status === "PAID" || e.status === "REIMBURSEMENT_PENDING") {
      approvedCount++;
    } else if (e.status === "MANAGER_REJECTED" || e.status === "FINANCE_REJECTED") {
      rejectedCount++;
    }
  });

  const pEl = document.getElementById("mgr-kpi-pending");
  const aEl = document.getElementById("mgr-kpi-approved");
  const rEl = document.getElementById("mgr-kpi-rejected");
  const tEl = document.getElementById("mgr-kpi-total");

  if (pEl) pEl.innerText = `${pendingCount} Claim${pendingCount !== 1 ? 's' : ''}`;
  if (aEl) aEl.innerText = `${approvedCount} Claim${approvedCount !== 1 ? 's' : ''}`;
  if (rEl) rEl.innerText = `${rejectedCount} Claim${rejectedCount !== 1 ? 's' : ''}`;
  if (tEl) tEl.innerText = formatAmount(totalOutstanding, userCurrency);

  const container = document.getElementById("approvals-table-body");
  if (!container) return;
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No standalone team claims in approval queue.</td></tr>`;
    return;
  }

  // Sort: Pending approvals on top, then by date desc and ID desc
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === "PENDING_MANAGER" && b.status !== "PENDING_MANAGER") return -1;
    if (a.status !== "PENDING_MANAGER" && b.status === "PENDING_MANAGER") return 1;
    const dateDiff = new Date(b.date) - new Date(a.date);
    if (dateDiff !== 0) return dateDiff;
    return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
  });

  sorted.forEach(e => {
    const row = document.createElement("tr");
    
    // Policy Warning check
    const policies = expenseDb.getTable("expensePolicies");
    const matchedPolicy = policies.find(p => p.type.toLowerCase() === e.type.toLowerCase());
    let policyAlert = `<span style="color: var(--approved-color);"><i class="fa-solid fa-circle-check"></i> Clean</span>`;
    
    if (matchedPolicy && e.amount > matchedPolicy.limit) {
      policyAlert = `<span style="color: var(--pending-color); font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Over budget</span>`;
    }

    const actionHtml = e.status === "PENDING_MANAGER" ? `
      <div class="action-buttons">
        <button class="btn btn-success btn-sm" onclick="approveExpenseDirect('${e.id}')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="openReasonModal('${e.id}', 'reject')">Reject</button>
        <button class="btn btn-warning btn-sm" onclick="openReasonModal('${e.id}', 'clarification')">Clarify</button>
      </div>
    ` : `<span style="color: var(--text-muted); font-style: italic;">Processed</span>`;

    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td><strong>${e.employeeName}</strong></td>
      <td>${e.project}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
      <td>${formatDate(e.date)}</td>
      <td style="text-align: center;">${policyAlert}</td>
      <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="text-align: center;">${actionHtml}</td>
    `;
    container.appendChild(row);
  });
}

function approveExpenseDirect(expId) {
  expenseDb.updateRecord("expenses", "id", expId, { 
    status: "PENDING_FINANCE", 
    remarks: `Approved by manager ${currentUser.name}` 
  });
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Approve Expense", `Approved team claim request ${expId}.`);
  showToast(`Expense ${expId} approved. Transferred to Finance settlement queue.`, "success");
  refreshUI();
}

// Rejection / Clarification modal trigger
function openReasonModal(expId, actionType) {
  pendingActionExpenseId = expId;
  pendingActionType = actionType;
  
  const title = document.getElementById("reason-modal-title");
  const label = document.getElementById("reason-modal-label");
  const select = document.getElementById("reason-modal-dropdown");
  const notes = document.getElementById("reason-modal-notes");
  
  notes.value = "";
  select.innerHTML = "";
  
  const reasons = expenseDb.getTable("reasons");
  
  if (actionType === "reject") {
    title.innerText = `Reject Claim ${expId}`;
    label.innerText = `Select Rejection Category`;
    reasons.filter(r => r.type === "Rejection" || r.type === "Both").forEach(r => {
      select.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });
  } else {
    title.innerText = `Request Clarification for ${expId}`;
    label.innerText = `Select Query Type`;
    reasons.filter(r => r.type === "Clarification" || r.type === "Both").forEach(r => {
      select.innerHTML += `<option value="${r.name}">${r.name}</option>`;
    });
  }

  document.getElementById("reason-modal-overlay").classList.add("active");
}

function closeReasonModal() {
  document.getElementById("reason-modal-overlay").classList.remove("active");
}

let activeReviewReportId = null;

function renderManagerPendingReports() {
  const container = document.getElementById("mgr-pending-reports-table-body");
  if (!container) return;
  
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();
  
  // Pending reports for manager approval
  const pendingReports = reports.filter(r => r.status === "PENDING_MANAGER");
  
  container.innerHTML = "";
  
  if (pendingReports.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No pending expense folders awaiting manager approval.</td></tr>`;
    return;
  }
  
  // Sort descending by ID
  const sortedReports = [...pendingReports].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));
  
  sortedReports.forEach(r => {
    const folderExpenses = expenses.filter(e => e.reportId === r.id);
    const cleanRange = sanitizeReportDateRange(r.startDate, r.endDate, folderExpenses);
    let currentTotal = 0;
    folderExpenses.forEach(e => {
      currentTotal += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    });

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="openReportApprovalModal('${r.id}')"><i class="fa-solid fa-folder"></i> ${r.id}</td>
      <td style="font-weight: 600; cursor: pointer;" onclick="openReportApprovalModal('${r.id}')">${r.title}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td>${formatDate(cleanRange.startDate)} - ${formatDate(cleanRange.endDate)}</td>
      <td style="text-align: center;"><span class="badge" style="background: rgba(79,70,229,0.1); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-weight: 700;">${folderExpenses.length} items</span></td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(currentTotal, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge pending_manager">PENDING MANAGER</span></td>
      <td style="text-align: center;">
        <button class="btn btn-primary btn-sm" onclick="openReportApprovalModal('${r.id}')"><i class="fa-solid fa-folder-open"></i> Review Folder</button>
      </td>
    `;
    container.appendChild(row);
  });
}

function openReportApprovalModal(reportId) {
  activeReviewReportId = reportId;
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  const userCurrency = getUserCurrency();
  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === reportId);
  const cleanRange = sanitizeReportDateRange(report.startDate, report.endDate, folderExpenses);

  document.getElementById("mgr-report-id").innerText = report.id;
  document.getElementById("mgr-report-title").innerHTML = `<i class="fa-solid fa-folder-open"></i> Review Folder: ${report.title} (${report.id})`;
  document.getElementById("mgr-report-employee").innerText = report.employeeName;
  document.getElementById("mgr-report-dates").innerText = `${formatDate(cleanRange.startDate)} to ${formatDate(cleanRange.endDate)}`;

  let totalSum = 0;
  folderExpenses.forEach(e => {
    totalSum += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
  });
  document.getElementById("mgr-report-total").innerText = formatAmount(totalSum, userCurrency);

  const container = document.getElementById("mgr-report-expenses-table-body");
  container.innerHTML = "";

  if (folderExpenses.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No expenses inside this folder.</td></tr>`;
  } else {
    // Sort folder expenses descending by ID
    const sortedExpenses = [...folderExpenses].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

    sortedExpenses.forEach(e => {
      const row = document.createElement("tr");
      
      const policies = expenseDb.getTable("expensePolicies");
      const matchedPolicy = policies.find(p => p.type.toLowerCase() === e.type.toLowerCase());
      let policyAlert = `<span style="color: var(--approved-color);"><i class="fa-solid fa-circle-check"></i> Clean</span>`;
      if (matchedPolicy && e.amount > matchedPolicy.limit) {
        policyAlert = `<span style="color: var(--pending-color); font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Over budget</span>`;
      }

      const actionButtons = e.status === "PENDING_MANAGER" ? `
        <div class="action-buttons" style="justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${e.id}')"><i class="fa-solid fa-receipt"></i> View</button>
          <button class="btn btn-success btn-sm" onclick="approveFolderExpenseItem('${e.id}')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="openReasonModal('${e.id}', 'reject')">Reject</button>
          <button class="btn btn-warning btn-sm" onclick="openReasonModal('${e.id}', 'clarification')">Clarify</button>
        </div>
      ` : `<div class="action-buttons" style="justify-content: center;">
            <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${e.id}')"><i class="fa-solid fa-receipt"></i> View</button>
            <span style="color: var(--text-muted); font-style: italic; align-self: center;">${e.status.replace(/_/g, " ")}</span>
           </div>`;

      row.innerHTML = `
        <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
        <td>${e.category}</td>
        <td>${e.type}</td>
        <td>${e.description}</td>
        <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
        <td style="text-align: center;">${policyAlert}</td>
        <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
        <td style="text-align: center;">${actionButtons}</td>
      `;
      container.appendChild(row);
    });
  }

  document.getElementById("report-approval-overlay").classList.add("active");
}

function closeReportApprovalModal() {
  document.getElementById("report-approval-overlay").classList.remove("active");
  activeReviewReportId = null;
  refreshUI();
}

function approveFolderExpenseItem(expId) {
  expenseDb.updateRecord("expenses", "id", expId, {
    status: "PENDING_FINANCE",
    remarks: `Approved by manager ${currentUser.name}`
  });
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Approve Folder Item", `Approved item ${expId} in folder ${activeReviewReportId}.`);
  showToast(`Item ${expId} approved and sent to Finance queue!`, "success");
  
  if (activeReviewReportId) {
    updateReportOverallStatus(activeReviewReportId);
    openReportApprovalModal(activeReviewReportId);
  }
}

function approveAllFolderExpenses() {
  if (!activeReviewReportId) return;
  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === activeReviewReportId && e.status === "PENDING_MANAGER");
  
  if (folderExpenses.length === 0) {
    showToast("All items in this folder have already been processed.", "info");
    return;
  }

  folderExpenses.forEach(e => {
    expenseDb.updateRecord("expenses", "id", e.id, {
      status: "PENDING_FINANCE",
      remarks: `Batch approved by manager ${currentUser.name}`
    });
  });

  updateReportOverallStatus(activeReviewReportId);
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Approve Folder All", `Batch approved all items in folder ${activeReviewReportId}.`);
  showToast(`All items in folder ${activeReviewReportId} approved & sent to Finance queue!`, "success");
  openReportApprovalModal(activeReviewReportId);
}

function rejectAllFolderExpenses() {
  if (!activeReviewReportId) return;
  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === activeReviewReportId && e.status === "PENDING_MANAGER");
  
  if (folderExpenses.length === 0) {
    showToast("All items in this folder have already been processed.", "info");
    return;
  }

  if (confirm(`Reject all remaining pending items in folder ${activeReviewReportId}?`)) {
    folderExpenses.forEach(e => {
      expenseDb.updateRecord("expenses", "id", e.id, {
        status: "MANAGER_REJECTED",
        remarks: `Batch rejected by manager ${currentUser.name}`
      });
    });

    updateReportOverallStatus(activeReviewReportId);
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Reject Folder All", `Batch rejected all items in folder ${activeReviewReportId}.`);
    showToast(`All items in folder ${activeReviewReportId} rejected!`, "error");
    openReportApprovalModal(activeReviewReportId);
  }
}

function updateReportOverallStatus(reportId) {
  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === reportId);
  
  if (folderExpenses.length === 0) return;
  
  const statuses = folderExpenses.map(e => e.status);
  const allApproved = statuses.every(s => s === "PENDING_FINANCE" || s === "FINANCE_APPROVED" || s === "PAID");
  const allRejected = statuses.every(s => s === "MANAGER_REJECTED" || s === "FINANCE_REJECTED");
  const hasPending = statuses.some(s => s === "PENDING_MANAGER");

  let newReportStatus = "PENDING_MANAGER";
  if (!hasPending) {
    if (allApproved) newReportStatus = "APPROVED";
    else if (allRejected) newReportStatus = "MANAGER_REJECTED";
    else newReportStatus = "PARTIALLY_APPROVED";
  }

  expenseDb.updateRecord("reports", "id", reportId, { status: newReportStatus });
}

function submitManagerAction() {
  const selectVal = document.getElementById("reason-modal-dropdown").value;
  const notesVal = document.getElementById("reason-modal-notes").value;
  const formattedRemarks = `${selectVal}: ${notesVal || "No custom remarks provided."}`;
  
  if (pendingActionType === "reject") {
    expenseDb.updateRecord("expenses", "id", pendingActionExpenseId, { 
      status: "MANAGER_REJECTED", 
      remarks: formattedRemarks 
    });
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Reject Expense", `Rejected team claim ${pendingActionExpenseId} - Reason: ${selectVal}`);
    showToast(`Claim ${pendingActionExpenseId} rejected.`, "error");
  } else {
    expenseDb.updateRecord("expenses", "id", pendingActionExpenseId, { 
      status: "CLARIFICATION_REQUIRED", 
      remarks: formattedRemarks 
    });
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Clarify Expense", `Sent clarification request on ${pendingActionExpenseId} - Reason: ${selectVal}`);
    showToast(`Query request sent for ${pendingActionExpenseId}.`, "success");
  }

  closeReasonModal();

  if (activeReviewReportId) {
    updateReportOverallStatus(activeReviewReportId);
    openReportApprovalModal(activeReviewReportId);
  } else {
    refreshUI();
  }
}

// ================= TEAM STATS CHARTS =================

function renderTeamCharts() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed

  const expenses = expenseDb.getTable("expenses").filter(e => 
    e.status !== "DRAFT" && 
    e.status !== "CANCELLED"
  );
  
  const userCurrency = getUserCurrency();
  
  // Update the chart title year label
  const yearLabelEl = document.getElementById("team-chart-year-label");
  if (yearLabelEl) yearLabelEl.innerText = currentYear;

  // 1. Monthly Team Spend (Bar chart) - show Jan to current month
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = Array(currentMonth + 1).fill(0);
  expenses.forEach(e => {
    const expDate = new Date(e.date);
    if (expDate.getFullYear() === currentYear) {
      const month = expDate.getMonth();
      if (month >= 0 && month <= currentMonth) {
        monthlyData[month] += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
      }
    }
  });

  const ctxMonthly = document.getElementById("team-chart-monthly").getContext("2d");
  if (charts["monthly"]) charts["monthly"].destroy();
  charts["monthly"] = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: monthLabels.slice(0, currentMonth + 1),
      datasets: [{
        label: 'Team Spend',
        data: monthlyData,
        backgroundColor: '#4f46e5',
        borderRadius: 4
      }]
    },
    options: {
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const firstElement = elements[0];
          const monthIndex = firstElement.index;
          showMonthExpenses(monthIndex, currentYear);
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'Team Spend: ' + formatAmount(context.raw, userCurrency);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (userCurrency === "IDR") {
                return value >= 1000000 ? (value / 1000000) + 'M' : (value >= 1000 ? (value / 1000) + 'K' : value);
              } else if (userCurrency === "INR") {
                return value >= 100000 ? (value / 100000) + 'L' : (value >= 1000 ? (value / 1000) + 'K' : value);
              } else {
                return value >= 1000 ? (value / 1000) + 'K' : value;
              }
            }
          }
        }
      }
    }
  });

  // 2. Categories Spend (Doughnut chart)
  const catSums = {};
  expenses.forEach(e => {
    catSums[e.category] = (catSums[e.category] || 0) + convertCurrency(e.amount, e.currency || "IDR", userCurrency);
  });

  const ctxCat = document.getElementById("team-chart-categories").getContext("2d");
  if (charts["categories"]) charts["categories"].destroy();
  charts["categories"] = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: Object.keys(catSums),
      datasets: [{
        data: Object.values(catSums),
        backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + formatAmount(context.raw, userCurrency);
            }
          }
        }
      }
    }
  });
}

// ================= MANAGER EXPANSION CONTROLLERS =================

function initManagerDashboard() {
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();
  
  // Team dashboard shows ALL expenses (including manager's own, for full team picture)
  const teamExpenses = expenses.filter(e => e.status !== "DRAFT" && e.status !== "CANCELLED");
  
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let totalOutstanding = 0;

  teamExpenses.forEach(e => {
    if (e.status === "PENDING_MANAGER") {
      pendingCount++;
      totalOutstanding += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    } else if (e.status === "APPROVED" || e.status === "FINANCE_APPROVED" || e.status === "PAID" || e.status === "REIMBURSEMENT_PENDING") {
      approvedCount++;
    } else if (e.status === "MANAGER_REJECTED" || e.status === "FINANCE_REJECTED") {
      rejectedCount++;
    }
  });

  document.getElementById("mgr-kpi-pending").innerText = `${pendingCount} Claim${pendingCount !== 1 ? 's' : ''}`;
  document.getElementById("mgr-kpi-approved").innerText = `${approvedCount} Claim${approvedCount !== 1 ? 's' : ''}`;
  document.getElementById("mgr-kpi-rejected").innerText = `${rejectedCount} Claim${rejectedCount !== 1 ? 's' : ''}`;
  document.getElementById("mgr-kpi-total").innerText = formatAmount(totalOutstanding, userCurrency);

  renderTeamCharts();
}

function renderManagerHistory(records = null) {
  if (!records) {
    const expenses = expenseDb.getTable("expenses");
    const teamExpenses = expenses.filter(e => e.status !== "DRAFT" && e.employeeId !== currentUser.employeeId);
    
    // History contains processed items (NOT pending manager)
    records = teamExpenses.filter(e => e.status !== "PENDING_MANAGER");
  }

  const container = document.getElementById("mgr-history-table-body");
  container.innerHTML = "";

  if (records.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No decision history found.</td></tr>`;
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
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
      <td>${formatDate(e.date)}</td>
      <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="font-size:11px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.remarks || "-"}</td>
    `;
    container.appendChild(row);
  });
}

function filterManagerHistoryTable(query) {
  const expenses = expenseDb.getTable("expenses");
  const teamExpenses = expenses.filter(e => e.status !== "DRAFT" && e.employeeId !== currentUser.employeeId);
  const processed = teamExpenses.filter(e => e.status !== "PENDING_MANAGER");

  const filtered = processed.filter(e => {
    return (
      e.id.toLowerCase().includes(query.toLowerCase()) ||
      e.employeeName.toLowerCase().includes(query.toLowerCase()) ||
      e.project.toLowerCase().includes(query.toLowerCase()) ||
      e.category.toLowerCase().includes(query.toLowerCase()) ||
      e.amount.toString().includes(query) ||
      (e.remarks && e.remarks.toLowerCase().includes(query.toLowerCase())) ||
      e.status.toLowerCase().includes(query.toLowerCase())
    );
  });

  renderManagerHistory(filtered);
}

// ================= TOAST NOTIFICATION =================

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

// ================= PERSONAL EXPENSES CONTROLLERS =================

function renderMyExpensesTable() {
  const expenses = expenseDb.getTable("expenses");
  const userExpenses = expenses.filter(e => e.employeeId === currentUser.employeeId);
  
  const container = document.getElementById("my-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";

  if (userExpenses.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">You have not filed any expenses.</td></tr>`;
    return;
  }

  // Sort descending by date
  const sorted = [...userExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(e => {
    const row = document.createElement("tr");
    const canCancel = e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "PENDING_FINANCE" || e.status === "CLARIFICATION_REQUIRED";
    
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.project}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
      <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.remarks || "-"}</td>
      <td style="text-align: center;">
        <div class="action-buttons" style="justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${e.id}')">View</button>
          ${e.status === "DRAFT" ? `<button class="btn btn-primary btn-sm" onclick="editDraft('${e.id}')">Edit</button>` : ""}
          ${e.status === "DRAFT" ? `<button class="btn btn-success btn-sm" onclick="submitDraft('${e.id}')">Submit</button>` : ""}
          ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="cancelExpense('${e.id}')">Cancel</button>` : ""}
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

function cancelExpense(expId) {
  if (confirm(`Are you sure you want to cancel expense ${expId}?`)) {
    expenseDb.updateRecord("expenses", "id", expId, { status: "CANCELLED" });
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Cancel Expense", `Cancelled expense request ${expId}.`);
    showToast(`Expense ${expId} cancelled.`, "success");
    refreshUI();
  }
}

function submitDraft(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  if (!expense) return;
  
  if (!expense.date || !expense.country || !expense.project || !expense.department || !expense.category || !expense.type || expense.amount <= 0 || !expense.description) {
    alert("This draft is incomplete. Loading it into the form so you can complete and submit it.");
    loadDraftIntoForm(expense);
    return;
  }
  
  expenseDb.updateRecord("expenses", "id", expId, { status: "UNREPORTED" });
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Submit Draft", `Submitted draft expense ${expId} to unreported pool.`);
  showToast(`Expense ${expId} submitted to unreported pool successfully.`, "success");
  refreshUI();
}

function editDraft(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  if (!expense) return;
  loadDraftIntoForm(expense);
}

function loadDraftIntoForm(expense) {
  editingDraftId = expense.id;
  
  navigateToTab("add-expense");
  
  document.getElementById("form-exp-date").value = expense.date;
  document.getElementById("form-exp-country").value = expense.country || "";
  cascadeCountry();
  
  document.getElementById("form-exp-project").value = expense.project || "";
  document.getElementById("form-exp-department").value = expense.department || "";
  
  document.getElementById("form-exp-category").value = expense.category || "";
  cascadeCategory();
  
  document.getElementById("form-exp-type").value = expense.type || "";
  document.getElementById("form-exp-amount").value = expense.amount > 0 ? expense.amount : "";
  document.getElementById("form-exp-currency").value = expense.currency || "IDR";
  document.getElementById("form-exp-payment").value = expense.paymentMethod || "Cash";
  document.getElementById("form-exp-desc").value = expense.description || "";
  document.getElementById("form-exp-remarks").value = expense.remarks || "";
  document.getElementById("form-exp-receipt-url").value = expense.receiptUrl || "";
  
  if (expense.receiptUrl && expense.receiptUrl !== "receipt_attached.png") {
    document.getElementById("upload-status-text").innerText = `Receipt file loaded!`;
    document.getElementById("upload-box").style.borderColor = "var(--approved-color)";
  } else {
    document.getElementById("upload-status-text").innerText = "Drag & drop receipt image or PDF here, or click to upload";
    document.getElementById("upload-box").style.borderColor = "var(--border-color)";
  }
  
  evaluatePolicyLimit();
}

function viewExpenseDetails(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  if (!expense) return;

  document.getElementById("det-exp-id").innerText = expense.id;
  
  const statusEl = document.getElementById("det-exp-status");
  statusEl.innerText = expense.status.replace("_", " ");
  statusEl.className = `status-badge ${expense.status.toLowerCase()}`;
  
  document.getElementById("det-exp-date").innerText = formatDate(expense.date);
  document.getElementById("det-exp-employee").innerText = expense.employeeName;
  document.getElementById("det-exp-project").innerText = expense.project;
  document.getElementById("det-exp-category").innerText = expense.category;
  document.getElementById("det-exp-type").innerText = expense.type;
  document.getElementById("det-exp-amount").innerText = formatAmount(expense.amount, expense.currency);
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
    // Wire the Download button
    const fileName = expense.receiptUrl.startsWith("data:") 
      ? `receipt_${expense.id}.jpg`
      : (expense.receiptUrl.split("/").pop().split("?")[0] || `receipt_${expense.id}.jpg`);
    downloadLink.href = resolvedSrc;
    downloadLink.download = fileName;
    downloadLink.style.display = "inline-flex";
    imgContainer.style.display = "block";
  } else {
    imgContainer.style.display = "none";
  }

  const overlay = document.getElementById("expense-details-overlay");
  overlay.classList.add("active");
}

function closeExpenseDetails() {
  const overlay = document.getElementById("expense-details-overlay");
  overlay.classList.remove("active");
}

function setupAddExpenseForm() {
  editingDraftId = null;
  document.getElementById("expense-claim-form").reset();
  document.getElementById("form-exp-date").valueAsDate = new Date();
  
  const countries = expenseDb.getTable("countries").filter(c => c.status === "Active");
  const cSelect = document.getElementById("form-exp-country");
  cSelect.innerHTML = `<option value="">Select Country</option>`;
  countries.forEach(c => {
    cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
  });

  const projects = expenseDb.getTable("projects").filter(p => p.status === "Active");
  const pSelect = document.getElementById("form-exp-project");
  pSelect.innerHTML = `<option value="">Select Project</option>`;
  projects.forEach(p => {
    pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
  });

  const departments = expenseDb.getTable("departments").filter(d => d.status === "Active");
  const dSelect = document.getElementById("form-exp-department");
  dSelect.innerHTML = `<option value="">Select Department</option>`;
  departments.forEach(d => {
    dSelect.innerHTML += `<option value="${d.code}">${d.name}</option>`;
  });

  const categories = expenseDb.getTable("expenseCategories").filter(cat => cat.status === "Active");
  const catSelect = document.getElementById("form-exp-category");
  catSelect.innerHTML = `<option value="">Select Category</option>`;
  categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
  });

  document.getElementById("form-exp-type").innerHTML = `<option value="">Select Type (Select Category first)</option>`;
  document.getElementById("policy-verdict-indicator").innerHTML = "";
  
  populateFormFolderDropdown();

  document.getElementById("upload-status-text").innerText = "Drag & drop receipt image or PDF here, or click to upload";
  document.getElementById("upload-box").style.borderColor = "var(--border-color)";
  document.getElementById("form-exp-receipt-file").value = "";
}

function populateFormFolderDropdown() {
  const folderSelect = document.getElementById("form-exp-report-folder");
  if (!folderSelect) return;
  folderSelect.innerHTML = `<option value="">-- No Folder (Unassigned) --</option>`;
  
  let reports = expenseDb.getTable("reports") || [];
  const userDraftFolders = reports.filter(r => r.employeeId === currentUser.employeeId && r.status === "DRAFT");
  userDraftFolders.forEach(f => {
    folderSelect.innerHTML += `<option value="${f.id}">📁 ${f.title} (${f.id})</option>`;
  });
}

function cascadeCountry() {
  const countryCode = document.getElementById("form-exp-country").value;
  const pSelect = document.getElementById("form-exp-project");
  
  pSelect.innerHTML = `<option value="">Select Project</option>`;
  
  if (countryCode) {
    const countryObj = expenseDb.getTable("countries").find(c => c.code === countryCode);
    if (countryObj && countryObj.currency) {
      document.getElementById("form-exp-currency").value = countryObj.currency;
    }
  }
  
  if (!countryCode) {
    const projects = expenseDb.getTable("projects").filter(p => p.status === "Active");
    projects.forEach(p => {
      pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
    });
    return;
  }
  
  const projects = expenseDb.getTable("projects").filter(p => p.country === countryCode && p.status === "Active");
  projects.forEach(p => {
    pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
  });
}

function cascadeCategory() {
  const catName = document.getElementById("form-exp-category").value;
  const typeSelect = document.getElementById("form-exp-type");
  
  typeSelect.innerHTML = `<option value="">Select Type</option>`;
  if (!catName) return;

  const catCode = expenseDb.getTable("expenseCategories").find(c => c.name === catName)?.code;
  if (!catCode) return;

  const types = expenseDb.getTable("expenseTypes").filter(t => t.category === catCode && t.status === "Active");
  types.forEach(t => {
    typeSelect.innerHTML += `<option value="${t.name}">${t.name}</option>`;
  });
}

function evaluatePolicyLimit() {
  const expTypeName = document.getElementById("form-exp-type").value;
  const amountVal = parseFloat(document.getElementById("form-exp-amount").value || 0);
  const indicator = document.getElementById("policy-verdict-indicator");
  
  indicator.innerHTML = "";
  
  if (!expTypeName || amountVal <= 0) return;

  const policies = expenseDb.getTable("expensePolicies");
  const matchedPolicy = policies.find(p => p.type.toLowerCase() === expTypeName.toLowerCase());

  if (matchedPolicy) {
    if (amountVal > matchedPolicy.limit) {
      if (matchedPolicy.action === "Block") {
        indicator.innerHTML = `<span style="color: var(--rejected-color); font-weight: 700; font-size: 13px;">
          <i class="fa-solid fa-circle-xmark"></i> Policy Blocked: Amount exceeds cap of ${formatIDR(matchedPolicy.limit)} (Policy ${matchedPolicy.id}).
        </span>`;
        return false;
      } else {
        indicator.innerHTML = `<span style="color: var(--pending-color); font-weight: 700; font-size: 13px;">
          <i class="fa-solid fa-circle-exclamation"></i> Policy Warning: Amount exceeds standard limit of ${formatIDR(matchedPolicy.limit)}. Warning flag will be logged.
        </span>`;
      }
    } else {
      indicator.innerHTML = `<span style="color: var(--approved-color); font-weight: 700; font-size: 13px;">
        <i class="fa-solid fa-circle-check"></i> Standard budget checked. Safe to submit.
      </span>`;
    }
  }
  return true;
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  
  const isPolicySafe = evaluatePolicyLimit();
  if (isPolicySafe === false) {
    alert("This submission is blocked because the expense amount exceeds the strict policy limit policy rule.");
    return;
  }

  saveExpenseWithStatus("UNREPORTED");
}

function saveExpenseDraft() {
  saveExpenseWithStatus("DRAFT");
}

function saveExpenseWithStatus(targetStatus) {
  const dateVal = document.getElementById("form-exp-date").value || new Date().toISOString().split("T")[0];
  const countryVal = document.getElementById("form-exp-country").value;
  const projectVal = document.getElementById("form-exp-project").value;
  const deptVal = document.getElementById("form-exp-department").value;
  const catVal = document.getElementById("form-exp-category").value;
  const typeVal = document.getElementById("form-exp-type").value;
  const amountVal = parseFloat(document.getElementById("form-exp-amount").value || 0);
  const currencyVal = document.getElementById("form-exp-currency").value;
  const paymentVal = document.getElementById("form-exp-payment").value;
  const descVal = document.getElementById("form-exp-desc").value;
  const receiptVal = document.getElementById("form-exp-receipt-url").value || "";
  const remarksVal = document.getElementById("form-exp-remarks").value;

  if (targetStatus !== "DRAFT") {
    if (!dateVal || !countryVal || !projectVal || !deptVal || !catVal || !typeVal || amountVal <= 0 || !descVal) {
      alert("Please fill in all required form fields first.");
      return;
    }
  }

  const selectedFolderId = document.getElementById("form-exp-report-folder")?.value || null;
  const expId = editingDraftId || ("EXP0" + (expenseDb.getTable("expenses").length + 1));
  const newExpense = {
    id: expId,
    date: dateVal,
    employeeId: currentUser.employeeId,
    employeeName: currentUser.name,
    country: countryVal,
    project: projectVal,
    department: deptVal,
    category: catVal,
    type: typeVal,
    amount: amountVal,
    currency: currencyVal,
    paymentMethod: paymentVal,
    description: descVal,
    receiptUrl: receiptVal,
    status: targetStatus,
    reportId: selectedFolderId,
    remarks: remarksVal,
    dateCreated: new Date().toISOString().split("T")[0]
  };

  if (editingDraftId) {
    expenseDb.updateRecord("expenses", "id", editingDraftId, newExpense);
  } else {
    expenseDb.addRecord("expenses", newExpense);
  }
  
  expenseDb.addLog(
    currentUser.employeeId, 
    currentUser.name, 
    targetStatus === "DRAFT" ? (editingDraftId ? "Update Draft" : "Create Draft") : "Add Unreported Expense", 
    `${editingDraftId ? 'Updated' : 'Logged new'} claim ${expId} for ${formatAmount(amountVal, currencyVal)} (${typeVal})`
  );

  showToast(targetStatus === "DRAFT" ? "Draft saved successfully!" : "Expense added to pool. You can now bundle it into a report.", "success");
  
  editingDraftId = null;
  navigateToTab("my-expenses");
}

// ================= OCR SCANNED RECEIPT SIMULATION =================

let ocrCameraStream = null;
const receiptMockOptions = [
  {
    img: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60",
    type: "Hotel",
    category: "Accommodation",
    amount: 1400000,
    desc: "2 Nights lodging stay Jakarta Hotel",
    remarks: "Scanned via OCR Hub reader"
  },
  {
    img: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=500&auto=format&fit=crop&q=60",
    type: "Flight",
    category: "Travel",
    amount: 4500000,
    desc: "Garuda Indonesia Jakarta to Bali",
    remarks: "Scanned flight boarding pass"
  },
  {
    img: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=60",
    type: "Lunch",
    category: "Food",
    amount: 150000,
    desc: "Lunch with developers",
    remarks: "Paper receipt capture"
  }
];

function triggerMockOCR() {
  const overlay = document.getElementById("ocr-scan-overlay");
  overlay.classList.add("active");
  startOcrCamera();
}

function startOcrCamera() {
  const video = document.getElementById("ocr-video");
  const imgElement = document.getElementById("ocr-scan-img");
  const statusMsg = document.getElementById("ocr-status-msg");
  const laser = document.getElementById("ocr-laser");
  const btnCapture = document.getElementById("btn-ocr-capture");
  const btnRetry = document.getElementById("btn-ocr-retry");
  const btnSelectFile = document.getElementById("btn-ocr-select-file");
  
  stopOcrCamera();
  
  statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Initializing camera...`;
  laser.style.display = "none";
  imgElement.style.display = "none";
  video.style.display = "none";
  btnCapture.style.display = "none";
  btnRetry.style.display = "none";
  btnSelectFile.style.display = "none";
  
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
      ocrCameraStream = stream;
      video.srcObject = stream;
      video.style.display = "block";
      btnCapture.style.display = "inline-block";
      statusMsg.innerText = "Camera active. Hold the receipt inside the screen and click Capture & Scan.";
    })
    .catch(err => {
      console.warn("Camera initialization failed:", err);
      statusMsg.innerHTML = `<span style="color: var(--rejected-color);"><i class="fa-solid fa-circle-exclamation"></i> Camera access denied or blocked. Please select a receipt file manually to scan.</span>`;
      btnSelectFile.style.display = "inline-block";
      btnRetry.style.display = "inline-block";
    });
}

function stopOcrCamera() {
  if (ocrCameraStream) {
    ocrCameraStream.getTracks().forEach(track => track.stop());
    ocrCameraStream = null;
  }
  const video = document.getElementById("ocr-video");
  if (video) {
    video.srcObject = null;
  }
}

function captureAndScanReceipt() {
  const video = document.getElementById("ocr-video");
  const canvas = document.getElementById("ocr-canvas");
  const imgElement = document.getElementById("ocr-scan-img");
  const statusMsg = document.getElementById("ocr-status-msg");
  const laser = document.getElementById("ocr-laser");
  const btnCapture = document.getElementById("btn-ocr-capture");
  const btnRetry = document.getElementById("btn-ocr-retry");
  
  if (!video || !video.srcObject) return;
  
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const capturedDataUrl = canvas.toDataURL("image/jpeg", 0.5);
  imgElement.src = capturedDataUrl;
  
  stopOcrCamera();
  
  video.style.display = "none";
  imgElement.style.display = "block";
  btnCapture.style.display = "none";
  btnRetry.style.display = "none";
  
  const selection = receiptMockOptions[Math.floor(Math.random() * receiptMockOptions.length)];
  selection.customImg = capturedDataUrl;
  
  runOcrAnalysis(selection);
}

function runOcrAnalysis(selection) {
  const statusMsg = document.getElementById("ocr-status-msg");
  const laser = document.getElementById("ocr-laser");
  
  laser.style.display = "block";
  statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Reading merchant info...`;
  
  setTimeout(() => {
    statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Extracting amount and line items...`;
  }, 800);

  setTimeout(() => {
    statusMsg.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Autofilling claim form...`;
  }, 1600);

  setTimeout(() => {
    closeOcrScanner();
    
    navigateToTab("add-expense");
    
    document.getElementById("form-exp-country").value = "ID";
    cascadeCountry();
    
    document.getElementById("form-exp-project").value = "PRJ-JAK";
    document.getElementById("form-exp-department").value = "IT";
    
    document.getElementById("form-exp-category").value = selection.category;
    cascadeCategory();
    document.getElementById("form-exp-type").value = selection.type;
    
    document.getElementById("form-exp-amount").value = selection.amount;
    const merchant = selection.type === "Hotel" ? "Jakarta Hotel Mulia" : selection.type === "Flight" ? "Garuda Indonesia" : "Starbucks Coffee";
    document.getElementById("form-exp-desc").value = `Claim for ${merchant} - ${selection.desc}`;
    document.getElementById("form-exp-remarks").value = selection.remarks + " (Captured via Device Camera)";
    document.getElementById("form-exp-receipt-url").value = selection.customImg || selection.img;

    document.getElementById("upload-status-text").innerText = `Receipt scanned! File: captured_receipt.png (${formatAmount(selection.amount, "IDR")})`;
    document.getElementById("upload-box").style.borderColor = "var(--approved-color)";

    evaluatePolicyLimit();
    showToast("Receipt captured and form data auto-filled!", "success");
    
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "OCR Scan", `Parsed merchant invoice matching ${formatAmount(selection.amount, "IDR")}.`);
  }, 2400);
}

function closeOcrScanner() {
  stopOcrCamera();
  document.getElementById("ocr-scan-overlay").classList.remove("active");
}

// ================= FILE UPLOAD CONTROLLERS =================

function triggerReceiptFileUpload() {
  document.getElementById("form-exp-receipt-file").click();
}

function handleReceiptFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  processSelectedReceiptFile(file);
}

function processSelectedReceiptFile(file) {
  const statusText = document.getElementById("upload-status-text");
  const uploadBox = document.getElementById("upload-box");
  const hiddenUrl = document.getElementById("form-exp-receipt-url");
  const fileInput = document.getElementById("form-exp-receipt-file");
  
  if (file.size > 5 * 1024 * 1024) {
    alert("File is too large. Maximum size allowed is 5MB.");
    fileInput.value = "";
    return;
  }
  
  statusText.innerText = `Selected file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  uploadBox.style.borderColor = "var(--approved-color)";
  
  const reader = new FileReader();
  reader.onload = function(e) {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        hiddenUrl.value = canvas.toDataURL("image/jpeg", 0.5);
      };
      img.src = e.target.result;
    } else {
      hiddenUrl.value = "receipt_attached.png";
    }
  };
  reader.readAsDataURL(file);
  
  showToast("File attached successfully!", "success");
}

function initDragAndDropUpload() {
  const uploadBox = document.getElementById("upload-box");
  if (!uploadBox) return;
  
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadBox.style.borderColor = "var(--primary)";
      uploadBox.style.background = "rgba(79, 70, 229, 0.05)";
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadBox.style.background = "";
      if (eventName === 'dragleave') {
        uploadBox.style.borderColor = "var(--border-color)";
      }
    }, false);
  });
  
  uploadBox.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file) {
      document.getElementById("form-exp-receipt-file").files = dt.files;
      processSelectedReceiptFile(file);
    }
  }, false);
}

function triggerOcrFileSelect() {
  document.getElementById("ocr-file-input").click();
}

function handleOcrFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  
  const imgElement = document.getElementById("ocr-scan-img");
  const statusMsg = document.getElementById("ocr-status-msg");
  const btnSelectFile = document.getElementById("btn-ocr-select-file");
  const btnRetry = document.getElementById("btn-ocr-retry");
  
  const reader = new FileReader();
  reader.onload = function(e) {
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement("canvas");
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        
        const compressedUrl = canvas.toDataURL("image/jpeg", 0.5);
        imgElement.src = compressedUrl;
        imgElement.style.display = "block";
        
        btnSelectFile.style.display = "none";
        btnRetry.style.display = "none";
        
        const selection = receiptMockOptions[Math.floor(Math.random() * receiptMockOptions.length)];
        selection.customImg = compressedUrl;
        runOcrAnalysis(selection);
      };
      img.src = e.target.result;
    } else {
      imgElement.src = "receipt_attached.png";
      imgElement.style.display = "block";
      btnSelectFile.style.display = "none";
      btnRetry.style.display = "none";
      
      const selection = receiptMockOptions[Math.floor(Math.random() * receiptMockOptions.length)];
      selection.customImg = "receipt_attached.png";
      runOcrAnalysis(selection);
    }
  };
  reader.readAsDataURL(file);
}

// ================= PERSONAL EXPENSE REPORTS CONTROLLERS =================

function initExpenseReportsPage() {
  document.getElementById("report-creation-form").reset();
  document.getElementById("report-start-date").valueAsDate = new Date();
  document.getElementById("report-end-date").valueAsDate = new Date();
  
  populateReportUsersDropdowns();
  renderUnreportedExpensesTable();
  closeReportDetails();
  switchReportTab("create-report-subtab");
}

function switchReportTab(subtabId) {
  document.querySelectorAll(".report-tab-content").forEach(content => {
    content.style.display = content.id === subtabId ? "block" : "none";
  });
  
  const btnCreate = document.getElementById("tab-btn-create");
  const btnHistory = document.getElementById("tab-btn-history");
  
  if (subtabId === "create-report-subtab") {
    btnCreate.className = "btn btn-primary";
    btnHistory.className = "btn btn-secondary";
    renderUnreportedExpensesTable();
  } else {
    btnCreate.className = "btn btn-secondary";
    btnHistory.className = "btn btn-primary";
    renderReportsHistoryTable();
  }
}

function populateReportUsersDropdowns() {
  const users = expenseDb.getTable("users");
  const approverSelect = document.getElementById("report-approver");
  const verifierSelect = document.getElementById("report-verifier");
  
  approverSelect.innerHTML = `<option value="">-- Select Approver --</option>`;
  verifierSelect.innerHTML = `<option value="">-- Select Verifier --</option>`;
  
  const managers = users.filter(u => u.role === "Manager" && u.status === "Active");
  managers.forEach(m => {
    approverSelect.innerHTML += `<option value="${m.name}">${m.name} (Manager)</option>`;
  });
  
  const verifiers = users.filter(u => (u.role === "Finance" || u.role === "Auditor") && u.status === "Active");
  verifiers.forEach(v => {
    verifierSelect.innerHTML += `<option value="${v.name}">${v.name} (${v.role})</option>`;
  });
}

function renderUnreportedExpensesTable() {
  const expenses = expenseDb.getTable("expenses");
  const unreported = expenses.filter(e => 
    e.employeeId === currentUser.employeeId && 
    e.status === "UNREPORTED" && 
    (!e.reportId)
  );
  
  const container = document.getElementById("unreported-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";
  
  document.getElementById("select-all-expenses").checked = false;
  
  if (unreported.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No unreported expenses. Please add some expenses first.</td></tr>`;
    return;
  }
  
  unreported.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="text-align: center;"><input type="checkbox" class="expense-select-chk" value="${e.id}"></td>
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.category}</td>
      <td>${e.description}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
    `;
    container.appendChild(row);
  });
}

function toggleSelectAllExpenses(masterCheckbox) {
  document.querySelectorAll(".expense-select-chk").forEach(chk => {
    chk.checked = masterCheckbox.checked;
  });
}

function handleReportSubmit(event) {
  event.preventDefault();
  
  const title = document.getElementById("report-title").value.trim();
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;
  const approver = document.getElementById("report-approver").value;
  const verifier = document.getElementById("report-verifier").value;
  
  const selectedCheckboxes = document.querySelectorAll(".expense-select-chk:checked");
  const selectedIds = Array.from(selectedCheckboxes).map(chk => chk.value);
  
  if (selectedIds.length === 0) {
    alert("Please select at least one unreported expense to include in this report.");
    return;
  }
  
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();
  let totalSum = 0;
  selectedIds.forEach(id => {
    const exp = expenses.find(e => e.id === id);
    if (exp) {
      totalSum += convertCurrency(exp.amount, exp.currency || "IDR", userCurrency);
    }
  });
  
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const rptId = "RPT" + String(reports.length + 1).padStart(3, '0');
  
  // ROUTING ROUTE: If Manager creates report, status becomes PENDING_FINANCE (validated by Finance)!
  const targetStatus = currentUser.role === "Manager" ? "PENDING_FINANCE" : "PENDING_MANAGER";
  
  const newReport = {
    id: rptId,
    title,
    startDate,
    endDate,
    approver,
    verifier,
    employeeId: currentUser.employeeId,
    employeeName: currentUser.name,
    status: targetStatus,
    totalAmount: totalSum,
    dateCreated: new Date().toISOString().split("T")[0]
  };
  
  expenseDb.addRecord("reports", newReport);
  
  selectedIds.forEach(id => {
    expenseDb.updateRecord("expenses", "id", id, {
      status: targetStatus,
      reportId: rptId
    });
  });
  
  expenseDb.addLog(
    currentUser.employeeId,
    currentUser.name,
    "Submit Expense Report",
    `Submitted expense report ${rptId} containing ${selectedIds.length} claims for a total of ${formatAmount(totalSum, userCurrency)}.`
  );
  
  showToast(`Report ${rptId} submitted successfully for ${currentUser.role === "Manager" ? 'Finance validation' : 'Manager approval'}!`, "success");
  switchReportTab("history-report-subtab");
}

function renderReportsHistoryTable() {
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const userCurrency = getUserCurrency();
  
  const userReports = reports.filter(r => r.employeeId === currentUser.employeeId);
  const container = document.getElementById("reports-history-table-body");
  if (!container) return;
  container.innerHTML = "";
  
  if (userReports.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No reports created yet.</td></tr>`;
    return;
  }
  
  const sorted = [...userReports].sort((a, b) => b.id.localeCompare(a.id));
  
  sorted.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${r.id}</td>
      <td style="font-weight: 600;">${r.title}</td>
      <td>${formatDate(r.startDate)} - ${formatDate(r.endDate)}</td>
      <td>${r.approver}</td>
      <td>${r.verifier}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(r.totalAmount, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge ${r.status.toLowerCase()}">${r.status.replace("_", " ")}</span></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="viewReportDetails('${r.id}')">View</button>
      </td>
    `;
    container.appendChild(row);
  });
}

function viewReportDetails(reportId) {
  const reports = expenseDb.getTable("reports");
  const report = reports.find(r => r.id === reportId);
  if (!report) return;
  
  const userCurrency = getUserCurrency();
  
  document.getElementById("det-report-id").innerText = report.id;
  document.getElementById("det-report-title").innerText = report.title;
  document.getElementById("det-report-status").innerText = report.status.replace("_", " ");
  document.getElementById("det-report-dates").innerText = `${formatDate(report.startDate)} to ${formatDate(report.endDate)}`;
  document.getElementById("det-report-created").innerText = formatDate(report.dateCreated);
  document.getElementById("det-report-approver").innerText = report.approver;
  document.getElementById("det-report-verifier").innerText = report.verifier;
  document.getElementById("det-report-total").innerText = formatAmount(report.totalAmount, userCurrency);
  
  const expenses = expenseDb.getTable("expenses");
  const reportExpenses = expenses.filter(e => e.reportId === report.id);
  
  const container = document.getElementById("report-expenses-details-body");
  container.innerHTML = "";
  
  reportExpenses.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.category}</td>
      <td>${e.description}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
    `;
    container.appendChild(row);
  });
  
  document.getElementById("report-details-container").style.display = "block";
}

function closeReportDetails() {
  document.getElementById("report-details-container").style.display = "none";
}

function showMonthExpenses(monthIndex, year, isPersonal = false) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[monthIndex];
  
  document.getElementById("month-expenses-title").innerText = isPersonal 
    ? `My Expenses for ${monthName} ${year}` 
    : `Team Expenses for ${monthName} ${year}`;
  
  const expenses = expenseDb.getTable("expenses");
  const filteredExpenses = isPersonal 
    ? expenses.filter(e => e.employeeId === currentUser.employeeId)
    : expenses.filter(e => e.status !== "DRAFT" && e.employeeId !== currentUser.employeeId);
  const userCurrency = getUserCurrency();
  
  const filtered = filteredExpenses.filter(e => {
    const expDate = new Date(e.date);
    return expDate.getFullYear() === year && 
           expDate.getMonth() === monthIndex && 
           e.status !== "DRAFT" && 
           e.status !== "CANCELLED" && 
           e.status !== "MANAGER_REJECTED" && 
           e.status !== "FINANCE_REJECTED";
  });
  
  const container = document.getElementById("month-expenses-table-body");
  container.innerHTML = "";
  
  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No expenses recorded for this month.</td></tr>`;
  } else {
    const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
    sorted.forEach(e => {
      const row = document.createElement("tr");
      row.style.borderBottom = "1px solid var(--border-color)";
      row.style.fontSize = "12px";
      row.innerHTML = `
        <td style="padding: 10px 6px; font-weight: 700; color: var(--primary); white-space: nowrap;">${e.id}</td>
        <td style="padding: 10px 6px; white-space: nowrap;">${formatDate(e.date)}</td>
        <td style="padding: 10px 6px; white-space: nowrap;">${e.project || "-"}</td>
        <td style="padding: 10px 6px;">${e.category || "-"}</td>
        <td style="padding: 10px 6px;">${e.type || "-"}</td>
        <td style="padding: 10px 6px; font-weight: 600; text-align: right; white-space: nowrap;">${formatAmount(e.amount, e.currency)}</td>
        <td style="padding: 10px 6px; text-align: center; white-space: nowrap;">
          <span class="status-badge ${e.status.toLowerCase()}" style="display: inline-block; font-size: 11px; padding: 3px 8px; margin: 0;">${e.status.replace("_", " ")}</span>
        </td>
      `;
      row.style.cursor = "pointer";
      row.onmouseover = () => { row.style.background = "rgba(255, 255, 255, 0.02)"; };
      row.onmouseout = () => { row.style.background = ""; };
      row.onclick = () => {
        closeMonthExpenses();
        viewExpenseDetails(e.id);
      };
      container.appendChild(row);
    });
  }
  
  const overlay = document.getElementById("month-expenses-overlay");
  overlay.classList.add("active");
}

function closeMonthExpenses() {
  const overlay = document.getElementById("month-expenses-overlay");
  overlay.classList.remove("active");
}

function filterHistoryTable(query) {
  const expenses = expenseDb.getTable("expenses");
  const userExpenses = expenses.filter(e => e.employeeId === currentUser.employeeId);

  const filtered = userExpenses.filter(e => {
    return (
      e.id.toLowerCase().includes(query.toLowerCase()) ||
      e.date.toLowerCase().includes(query.toLowerCase()) ||
      e.project.toLowerCase().includes(query.toLowerCase()) ||
      e.category.toLowerCase().includes(query.toLowerCase()) ||
      e.amount.toString().includes(query) ||
      (e.remarks && e.remarks.toLowerCase().includes(query.toLowerCase())) ||
      e.status.toLowerCase().includes(query.toLowerCase())
    );
  });

  const container = document.getElementById("my-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No matching transactions found.</td></tr>`;
    return;
  }

  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(e => {
    const row = document.createElement("tr");
    const canCancel = e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "PENDING_FINANCE" || e.status === "CLARIFICATION_REQUIRED";
    
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.project}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
      <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.remarks || "-"}</td>
      <td style="text-align: center;">
        <div class="action-buttons" style="justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${e.id}')">View</button>
          ${e.status === "DRAFT" ? `<button class="btn btn-primary btn-sm" onclick="editDraft('${e.id}')">Edit</button>` : ""}
          ${e.status === "DRAFT" ? `<button class="btn btn-success btn-sm" onclick="submitDraft('${e.id}')">Submit</button>` : ""}
          ${canCancel ? `<button class="btn btn-danger btn-sm" onclick="cancelExpense('${e.id}')">Cancel</button>` : ""}
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

function refreshDashboard() {
  const expenses = expenseDb.getTable("expenses");
  const myExpenses = expenses.filter(e => e.employeeId === currentUser.employeeId);
  const userCurrency = getUserCurrency();

  let approvedSum = 0;
  let pendingSum = 0;
  let rejectedSum = 0;

  myExpenses.forEach(e => {
    const amountInUserCurrency = convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    if (e.status === "APPROVED" || e.status === "FINANCE_APPROVED" || e.status === "PAID" || e.status === "REIMBURSEMENT_PENDING") {
      approvedSum += amountInUserCurrency;
    } else if (e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "PENDING_FINANCE" || e.status === "UNREPORTED") {
      pendingSum += amountInUserCurrency;
    } else if (e.status === "MANAGER_REJECTED" || e.status === "FINANCE_REJECTED") {
      rejectedSum += amountInUserCurrency;
    }
  });

  const totalSum = approvedSum + pendingSum + rejectedSum;

  document.getElementById("db-kpi-total").innerText = formatAmount(totalSum, userCurrency);
  document.getElementById("db-kpi-approved").innerText = formatAmount(approvedSum, userCurrency);
  document.getElementById("db-kpi-pending").innerText = formatAmount(pendingSum, userCurrency);
  document.getElementById("db-kpi-rejected").innerText = formatAmount(rejectedSum, userCurrency);

  // Render Monthly Expenses Bar Chart
  const selectedYear = parseInt(document.getElementById("dashboard-year-select").value) || 2026;
  const monthlyData = Array(12).fill(0); // Jan to Dec
  myExpenses.forEach(e => {
    const expDate = new Date(e.date);
    if (expDate.getFullYear() === selectedYear && 
        e.status !== "DRAFT" && 
        e.status !== "CANCELLED" && 
        e.status !== "MANAGER_REJECTED" && 
        e.status !== "FINANCE_REJECTED") {
      const month = expDate.getMonth();
      if (month >= 0 && month <= 11) {
        monthlyData[month] += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
      }
    }
  });

  const ctxMonthly = document.getElementById("chart-monthly").getContext("2d");
  if (charts["personal-monthly"]) charts["personal-monthly"].destroy();
  charts["personal-monthly"] = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: 'My Spend',
        data: monthlyData,
        backgroundColor: '#4f46e5',
        borderRadius: 4
      }]
    },
    options: {
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          const firstElement = elements[0];
          const monthIndex = firstElement.index;
          showMonthExpenses(monthIndex, selectedYear, true);
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return 'My Spend: ' + formatAmount(context.raw, userCurrency);
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (userCurrency === "IDR") {
                return value >= 1000000 ? (value / 1000000) + 'M' : (value >= 1000 ? (value / 1000) + 'K' : value);
              } else if (userCurrency === "INR") {
                return value >= 100000 ? (value / 100000) + 'L' : (value >= 1000 ? (value / 1000) + 'K' : value);
              } else {
                return value >= 1000 ? (value / 1000) + 'K' : value;
              }
            }
          }
        }
      }
    }
  });

  // Render Category allocation progress list (percentage breakdown)
  const catSums = {};
  myExpenses.forEach(e => {
    if (e.status !== "DRAFT" && 
        e.status !== "CANCELLED" && 
        e.status !== "MANAGER_REJECTED" && 
        e.status !== "FINANCE_REJECTED") {
      catSums[e.category] = (catSums[e.category] || 0) + convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    }
  });

  const progressContainer = document.getElementById("db-category-progress");
  progressContainer.innerHTML = "";

  const categories = expenseDb.getTable("expenseCategories").filter(c => c.status === "Active");
  
  let totalSpentAcrossCategories = 0;
  categories.forEach(cat => {
    totalSpentAcrossCategories += (catSums[cat.name] || 0);
  });

  categories.forEach(cat => {
    const sum = catSums[cat.name] || 0;
    const percentage = totalSpentAcrossCategories > 0 ? Math.round((sum / totalSpentAcrossCategories) * 100) : 0;

    progressContainer.innerHTML += `
      <div class="progress-item">
        <div class="progress-label-row">
          <span class="progress-label"><i class="fa-solid fa-${cat.icon || 'tag'}"></i> ${cat.name}</span>
          <span class="progress-percentage">${percentage}%</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${percentage}%"></div>
        </div>
      </div>
    `;
  });

  // Render Recent Activity (Last 10 Days)
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  tenDaysAgo.setHours(0, 0, 0, 0);

  const recentExpenses = myExpenses.filter(e => {
    const expDate = new Date(e.date);
    return expDate >= tenDaysAgo;
  });

  const sortedRecent = [...recentExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  const recentContainer = document.getElementById("db-recent-expenses-body");
  recentContainer.innerHTML = "";

  if (sortedRecent.length === 0) {
    recentContainer.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expenses recorded in the last 10 days.</td></tr>`;
  } else {
    sortedRecent.forEach(e => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
        <td>${formatDate(e.date)}</td>
        <td>${e.category}</td>
        <td>${e.project}</td>
        <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
        <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      `;
      recentContainer.appendChild(row);
    });
  }
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

// ================= MY SETTLEMENTS & REIMBURSEMENTS (VIEW ONLY) =================

let cachedEmpSettlementEntries = [];
let cachedEmpCurrency = "USD";

function getEmployeeSettlementData() {
  const employees = expenseDb.getTable("employees") || [];
  const expenses = expenseDb.getTable("expenses") || [];
  const settlements = expenseDb.getTable("settlements") || [];
  const reimbursements = expenseDb.getTable("reimbursements") || [];

  // Match current employee / manager record
  const currentEmp = employees.find(e => 
    (currentUser.employeeId && e.id && e.id.toLowerCase() === currentUser.employeeId.toLowerCase()) ||
    (currentUser.email && e.email && e.email.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser.name && e.name && e.name.toLowerCase() === currentUser.name.toLowerCase()) ||
    (currentUser.id && e.id && e.id.toLowerCase() === currentUser.id.toLowerCase())
  );

  const empId = currentEmp ? currentEmp.id : (currentUser.employeeId || currentUser.id || "EMP001");
  const empName = currentEmp ? currentEmp.name : currentUser.name;

  // Primary currency
  let primaryCurrency = "USD";
  if (currentEmp && currentEmp.country === "ID") primaryCurrency = "IDR";
  else if (currentEmp && currentEmp.country === "IN") primaryCurrency = "INR";
  else if (currentEmp && (currentEmp.country === "DE" || currentEmp.country === "FR")) primaryCurrency = "EUR";

  // Filter ONLY this manager's personal records
  const empExpenses = expenses.filter(e => 
    (e.employeeId && (e.employeeId.toLowerCase() === empId.toLowerCase() || e.employeeId.toLowerCase() === empName.toLowerCase())) ||
    (e.employeeName && e.employeeName.toLowerCase() === empName.toLowerCase())
  );

  const empSettlements = settlements.filter(s => 
    (s.employeeId && (s.employeeId.toLowerCase() === empId.toLowerCase() || s.employeeId.toLowerCase() === empName.toLowerCase())) ||
    (s.employeeName && s.employeeName.toLowerCase() === empName.toLowerCase())
  );

  const empReimbursements = reimbursements.filter(r => 
    (r.employeeId && (r.employeeId.toLowerCase() === empId.toLowerCase() || r.employeeId.toLowerCase() === empName.toLowerCase())) ||
    (r.employeeName && r.employeeName.toLowerCase() === empName.toLowerCase())
  );

  if (empExpenses.length > 0 && empExpenses[0].currency) {
    primaryCurrency = empExpenses[0].currency;
  }

  const entries = [];

  // Debits: Approved / Settled expense claims submitted by manager
  empExpenses.forEach(exp => {
    const isApproved = ["FINANCE_APPROVED", "PAID", "SETTLED", "APPROVED", "Approved", "Settled"].includes(exp.status);
    if (isApproved) {
      entries.push({
        id: exp.id,
        type: "EXPENSE_CLAIM",
        typeLabel: "Expense Claim",
        date: exp.date || exp.dateCreated || "2026-08-01",
        description: exp.description || `${exp.category} - ${exp.type}`,
        debit: parseFloat(exp.amount) || 0,
        credit: 0,
        status: exp.status || "APPROVED",
        mode: exp.paymentMethod || "Corporate Claim",
        notes: exp.remarks || `Expense claim for ${exp.category}`,
        currency: exp.currency || primaryCurrency
      });
    }
  });

  // Credits: Settlements disbursed to manager
  empSettlements.forEach(st => {
    entries.push({
      id: st.id,
      type: "SETTLEMENT_PAYOUT",
      typeLabel: "Settlement Payout",
      date: st.dateCreated ? st.dateCreated.split(" ")[0] : (st.paymentDate || "2026-08-25"),
      description: st.notes || `Disbursement: ${st.mode || "Bank Transfer"}`,
      debit: 0,
      credit: parseFloat(st.amount) || 0,
      status: "SETTLED",
      mode: st.mode || "Bank Transfer",
      notes: st.notes || `Disbursed to manager via ${st.mode || 'Bank Transfer'}`,
      currency: st.currency || primaryCurrency
    });
  });

  // Credits: Direct reimbursements paid out
  empReimbursements.forEach(rm => {
    if (!empSettlements.some(st => st.id === rm.id || st.notes === rm.remarks)) {
      entries.push({
        id: rm.id,
        type: "REIMBURSEMENT_PAID",
        typeLabel: "Reimbursement",
        date: rm.paymentDate || rm.paidDate || "2026-08-20",
        description: rm.remarks || `Direct Reimbursement (${rm.paymentMethod || "Bank Clearance"})`,
        debit: 0,
        credit: parseFloat(rm.amount) || 0,
        status: "PAID",
        mode: rm.paymentMethod || "Bank Transfer",
        notes: rm.remarks || "ERP Reimbursement clearance",
        currency: rm.currency || primaryCurrency
      });
    }
  });

  // Chronological sort
  entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  let runningBalance = 0;
  let totalDebits = 0;
  let totalCredits = 0;

  entries.forEach(e => {
    runningBalance += (e.debit - e.credit);
    totalDebits += e.debit;
    totalCredits += e.credit;
    e.closingBalance = runningBalance;
  });

  cachedEmpSettlementEntries = entries;
  cachedEmpCurrency = primaryCurrency;

  return {
    employee: currentEmp || { id: empId, name: empName },
    currency: primaryCurrency,
    totalDebits,
    totalCredits,
    closingBalance: runningBalance,
    entries
  };
}

function initEmployeeSettlements() {
  const data = getEmployeeSettlementData();
  const curr = data.currency;

  const fmt = (num) => `${curr} ${Number(num || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Update KPIs
  const debitEl = document.getElementById("emp-settle-kpi-debits");
  const creditEl = document.getElementById("emp-settle-kpi-credits");
  const balEl = document.getElementById("emp-settle-kpi-balance");
  const balSubEl = document.getElementById("emp-settle-kpi-bal-sub");
  const statusEl = document.getElementById("emp-settle-kpi-status");

  if (debitEl) debitEl.textContent = fmt(data.totalDebits);
  if (creditEl) creditEl.textContent = fmt(data.totalCredits);

  if (balEl) {
    if (data.closingBalance > 0) {
      balEl.textContent = fmt(data.closingBalance) + " Dr.";
      balEl.style.color = "#d97706";
      if (balSubEl) balSubEl.textContent = "Payable balance pending disbursement";
    } else if (data.closingBalance < 0) {
      balEl.textContent = fmt(Math.abs(data.closingBalance)) + " Cr.";
      balEl.style.color = "#2563eb";
      if (balSubEl) balSubEl.textContent = "Advance surplus credit";
    } else {
      balEl.textContent = fmt(0);
      balEl.style.color = "#10b981";
      if (balSubEl) balSubEl.textContent = "All claims cleared & settled";
    }
  }

  if (statusEl) {
    if (data.closingBalance === 0 && data.entries.length > 0) {
      statusEl.innerHTML = `<span class="status-badge approved"><i class="fa-solid fa-circle-check"></i> Fully Settled</span>`;
    } else if (data.closingBalance > 0) {
      statusEl.innerHTML = `<span class="status-badge pending"><i class="fa-solid fa-clock"></i> Payout Pending</span>`;
    } else {
      statusEl.innerHTML = `<span class="status-badge approved"><i class="fa-solid fa-check"></i> Account Up to Date</span>`;
    }
  }

  renderEmployeeSettlements(data.entries);
}

function renderEmployeeSettlements(entriesToRender) {
  const tbody = document.getElementById("emp-settle-table-body");
  const countEl = document.getElementById("emp-settle-record-count");
  if (!tbody) return;
  tbody.innerHTML = "";

  const curr = cachedEmpCurrency;
  const fmt = (num) => num > 0 ? `${curr} ${Number(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "-";

  if (!entriesToRender || entriesToRender.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--text-muted); padding: 24px;">
      <i class="fa-solid fa-receipt" style="font-size: 24px; color: #cbd5e1; margin-bottom: 8px; display: block;"></i>
      No settlement or disbursement entries found for your account.
    </td></tr>`;
    if (countEl) countEl.textContent = "Showing 0 entries";
    return;
  }

  if (countEl) countEl.textContent = `Showing ${entriesToRender.length} statement ${entriesToRender.length === 1 ? 'entry' : 'entries'}`;

  entriesToRender.forEach(e => {
    let typeBadge = "";
    if (e.type === "EXPENSE_CLAIM") {
      typeBadge = `<span class="status-badge" style="background:#eef2ff; color:#4338ca;"><i class="fa-solid fa-receipt" style="font-size:9.5px; margin-right:3px;"></i> Claim</span>`;
    } else if (e.type === "SETTLEMENT_PAYOUT") {
      typeBadge = `<span class="status-badge approved"><i class="fa-solid fa-money-bill-transfer" style="font-size:9.5px; margin-right:3px;"></i> Settlement</span>`;
    } else {
      typeBadge = `<span class="status-badge" style="background:#ecfdf5; color:#047857;"><i class="fa-solid fa-building-columns" style="font-size:9.5px; margin-right:3px;"></i> Reimbursement</span>`;
    }

    const balText = e.closingBalance > 0 ? `${curr} ${Number(e.closingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })} Dr.` : `${curr} ${Number(Math.abs(e.closingBalance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${e.date}</td>
      <td><strong>${e.id}</strong></td>
      <td>${typeBadge}</td>
      <td>
        <div style="font-weight: 500; color: var(--text-dark);">${e.description}</div>
        <div style="font-size: 10.5px; color: var(--text-muted);">${e.mode || "Bank"}</div>
      </td>
      <td style="text-align: right; color: ${e.debit > 0 ? '#ef4444' : 'inherit'}; font-weight: ${e.debit > 0 ? '600' : 'normal'};">
        ${fmt(e.debit)}
      </td>
      <td style="text-align: right; color: ${e.credit > 0 ? '#10b981' : 'inherit'}; font-weight: ${e.credit > 0 ? '600' : 'normal'};">
        ${fmt(e.credit)}
      </td>
      <td style="text-align: right; font-weight: 700; color: ${e.closingBalance > 0 ? '#d97706' : '#10b981'};">
        ${balText}
      </td>
      <td style="text-align: center;">
        <span class="status-badge ${e.status === 'SETTLED' || e.status === 'PAID' || e.status === 'APPROVED' ? 'approved' : 'pending'}" style="font-size: 10px;">
          ${e.status}
        </span>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="openEmpSettleDetailModal('${e.id}')" title="View Official Voucher (Read-Only)">
          <i class="fa-solid fa-eye"></i> View
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterEmployeeSettlements() {
  const query = (document.getElementById("emp-settle-search")?.value || "").trim().toLowerCase();
  const typeFilter = document.getElementById("emp-settle-filter-type")?.value || "ALL";

  const filtered = cachedEmpSettlementEntries.filter(e => {
    const matchesType = (typeFilter === "ALL") || (e.type === typeFilter);
    const matchesSearch = !query || 
      (e.id && e.id.toLowerCase().includes(query)) ||
      (e.description && e.description.toLowerCase().includes(query)) ||
      (e.mode && e.mode.toLowerCase().includes(query)) ||
      (e.notes && e.notes.toLowerCase().includes(query)) ||
      (e.status && e.status.toLowerCase().includes(query));
    return matchesType && matchesSearch;
  });

  renderEmployeeSettlements(filtered);
}

function openEmpSettleDetailModal(voucherId) {
  const entry = cachedEmpSettlementEntries.find(e => e.id === voucherId);
  if (!entry) return;

  const modal = document.getElementById("modal-emp-settle-detail");
  if (!modal) return;

  const curr = cachedEmpCurrency;
  const amt = entry.debit > 0 ? entry.debit : entry.credit;

  document.getElementById("emp-sd-id").textContent = entry.id;
  document.getElementById("emp-sd-date").textContent = entry.date;
  document.getElementById("emp-sd-type").textContent = entry.typeLabel || entry.type;
  document.getElementById("emp-sd-status").textContent = entry.status;
  document.getElementById("emp-sd-mode").textContent = entry.mode || "Bank Transfer";
  document.getElementById("emp-sd-amount").textContent = `${curr} ${Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById("emp-sd-desc").textContent = entry.description || "-";
  document.getElementById("emp-sd-notes").textContent = entry.notes || "Official disbursement and clearance recorded by Finance.";

  modal.classList.add("active");
}

function closeEmpSettleDetailModal() {
  const modal = document.getElementById("modal-emp-settle-detail");
  if (modal) modal.classList.remove("active");
}

function exportEmployeeSettlements(format) {
  const today = new Date().toISOString().split("T")[0];
  const entries = cachedEmpSettlementEntries;
  const curr = cachedEmpCurrency;

  if (format === "pdf") {
    const headers = ["Date", "Voucher ID", "Type", "Description", "Mode", `Debit (${curr})`, `Credit (${curr})`, `Balance (${curr})`, "Status"];
    const rows = entries.map(e => [
      e.date,
      e.id,
      e.typeLabel || e.type,
      e.description,
      e.mode || "",
      e.debit > 0 ? e.debit.toFixed(2) : "-",
      e.credit > 0 ? e.credit.toFixed(2) : "-",
      e.closingBalance.toFixed(2),
      e.status
    ]);

    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`EXPENSE ERP - Settlement Statement (${currentUser.name})`, 14, 13);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Exported: ${today} | Total Entries: ${entries.length}`, doc.internal.pageSize.getWidth() - 14, 13, { align: "right" });

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

      doc.save(`Settlement_Statement_${currentUser.name.replace(/\s+/g, "_")}_${today}.pdf`);
      showToast("Settlement statement exported as PDF.", "success");
    } else {
      const win = window.open("", "_blank");
      if (!win) return;
      const html = `<!DOCTYPE html><html><head><title>Settlement Statement - ${currentUser.name}</title><style>
        body { font-family: sans-serif; padding: 20px; }
        h2 { color: #4f46e5; margin-bottom: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 14px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 10px; text-align: left; }
        th { background: #4f46e5; color: #fff; }
      </style></head><body>
        <h2>Settlement Statement: ${currentUser.name}</h2>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>`;
      win.document.write(html);
      win.document.close();
      showToast("Opening printable preview...", "success");
    }
  } else if (format === "csv") {
    let csv = `Date,Voucher ID,Type,Description,Mode,Debit (${curr}),Credit (${curr}),Balance (${curr}),Status\n`;
    entries.forEach(e => {
      csv += `"${e.date}","${e.id}","${e.typeLabel || e.type}","${e.description}","${e.mode || ''}",${e.debit},${e.credit},${e.closingBalance},"${e.status}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Settlement_Statement_${currentUser.name.replace(/\s+/g, "_")}_${today}.csv`;
    link.click();
    showToast("Settlement statement exported as CSV.", "success");
  }
}
