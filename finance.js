// Finance Portal Controller Logic

const sessionData = sessionStorage.getItem("EXPENSE_SESSION");
const currentUser = JSON.parse(sessionData);

let activeTab = "team-dashboard";
let editingDraftId = null;
const charts = {};

document.addEventListener("DOMContentLoaded", () => {
  initFinancePortal();
});

function initFinancePortal() {
  document.getElementById("user-display-name").innerText = currentUser.name;
  document.getElementById("user-display-role").innerText = currentUser.role;
  document.getElementById("user-display-avatar").innerText = currentUser.name.charAt(0);
  document.getElementById("page-subtitle").innerText = `Welcome back, ${currentUser.name}`;

  document.querySelectorAll(".menu-item[data-view]").forEach(item => {
    item.addEventListener("click", (e) => {
      const view = e.currentTarget.getAttribute("data-view");
      navigateToTab(view);
    });
  });

  renderFinPendingReports();
  navigateToTab("team-dashboard");
}

function navigateToTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll(".menu-item[data-view]").forEach(item => {
    item.getAttribute("data-view") === tabName
      ? item.classList.add("active")
      : item.classList.remove("active");
  });

  const sections = [
    "team-dashboard", "finance-verify", "payment-processing", "reimbursement-track",
    "my-dashboard", "add-expense", "expense-reports", "my-expenses"
  ];
  sections.forEach(s => {
    const panel = document.getElementById(`view-${s}`);
    if (panel) panel.style.display = (s === tabName) ? "block" : "none";
  });

  const titles = {
    "team-dashboard": "Finance Team Dashboard",
    "finance-verify": "Finance Verification Desk",
    "payment-processing": "Payment Processing Settlements",
    "reimbursement-track": "Reimbursement Tracking Ledger",
    "my-dashboard": "My Expense Dashboard",
    "add-expense": "Create Expense Claim",
    "expense-reports": "Expense Reports Desk",
    "my-expenses": "My Expense History"
  };
  document.getElementById("page-title").innerText = titles[tabName] || "Finance Portal";

  if (tabName === "team-dashboard") {
    initTeamDashboard();
  } else if (tabName === "finance-verify") {
    renderFinanceKPIs();
    renderFinPendingReports();
    renderVerificationTable();
  } else if (tabName === "payment-processing") {
    renderPaymentProcessingTable();
  } else if (tabName === "reimbursement-track") {
    renderReimbursementTrackingTable();
  } else if (tabName === "my-dashboard") {
    refreshDashboard();
  } else if (tabName === "add-expense") {
    setupAddExpenseForm();
  } else if (tabName === "expense-reports") {
    initExpenseReportsPage();
  } else if (tabName === "my-expenses") {
    renderMyExpensesTable();
  }
}

// ================= MULTI-CURRENCY HELPERS =================

const EXCHANGE_RATES = {
  IDR: 1.0,
  INR: 175.0,
  USD: 15000.0,
  EUR: 16500.0
};

function getUserCurrency() {
  if (!currentUser) return "IDR";
  const countryCode = currentUser.country || "ID";
  const countryObj = expenseDb.getTable("countries").find(c => c.code === countryCode);
  return countryObj ? countryObj.currency : "IDR";
}

function convertCurrency(amount, fromCurrency, toCurrency) {
  const from = fromCurrency || "IDR";
  const to = toCurrency || "IDR";
  const fromRate = EXCHANGE_RATES[from] || 1.0;
  const toRate = EXCHANGE_RATES[to] || 1.0;
  return (amount * fromRate) / toRate;
}

function formatAmount(amount, currency) {
  const code = currency || "IDR";
  const currencyObj = expenseDb.getTable("currencies").find(c => c.code === code);
  const symbol = currencyObj ? currencyObj.symbol : (code === "IDR" ? "Rp" : code);
  return symbol + " " + new Intl.NumberFormat("id-ID").format(Math.round(amount));
}

function formatIDR(value) {
  return formatAmount(value, "IDR");
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ================= FINANCE KPIs =================

function refreshFinanceKPIs() {
  const expenses = expenseDb.getTable("expenses");
  const reimbursements = expenseDb.getTable("reimbursements");
  const userCurrency = getUserCurrency();

  const pendingVerify = expenses.filter(e => e.status === "PENDING_FINANCE").length;
  const readyPayout = expenses.filter(e => e.status === "FINANCE_APPROVED").length;
  const rejectedCount = expenses.filter(e => e.status === "FINANCE_REJECTED").length;

  let totalPaid = 0;
  reimbursements.forEach(r => {
    totalPaid += convertCurrency(r.amount, r.currency || "IDR", userCurrency);
  });

  const pEl = document.getElementById("fin-kpi-pending");
  const aEl = document.getElementById("fin-kpi-approved");
  const paidEl = document.getElementById("fin-kpi-paid");
  const rEl = document.getElementById("fin-kpi-rejected");

  if (pEl) pEl.innerText = `${pendingVerify} Claim${pendingVerify !== 1 ? 's' : ''}`;
  if (aEl) aEl.innerText = `${readyPayout} Claim${readyPayout !== 1 ? 's' : ''}`;
  if (paidEl) paidEl.innerText = formatAmount(totalPaid, userCurrency);
  if (rEl) rEl.innerText = `${rejectedCount} Claim${rejectedCount !== 1 ? 's' : ''}`;
}

function refreshUI() {
  refreshFinanceKPIs();
  if (activeTab === "finance-verify") renderVerificationTable();
  else if (activeTab === "payment-processing") renderPaymentProcessingTable();
  else if (activeTab === "reimbursement-track") renderReimbursementTrackingTable();
  else if (activeTab === "team-dashboard") initTeamDashboard();
}

// ================= TEAM DASHBOARD =================

function initTeamDashboard() {
  refreshFinanceKPIs();
  renderFinanceCharts();
}

function renderFinanceCharts() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const userCurrency = getUserCurrency();

  const yearLabelEl = document.getElementById("fin-chart-year-label");
  if (yearLabelEl) yearLabelEl.innerText = currentYear;

  const expenses = expenseDb.getTable("expenses").filter(e =>
    e.status !== "DRAFT" && e.status !== "CANCELLED"
  );

  // Monthly bar chart
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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

  const ctxMonthly = document.getElementById("fin-chart-monthly").getContext("2d");
  if (charts["fin-monthly"]) charts["fin-monthly"].destroy();
  charts["fin-monthly"] = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: monthLabels.slice(0, currentMonth + 1),
      datasets: [{ label: 'Team Spend', data: monthlyData, backgroundColor: '#4f46e5', borderRadius: 4 }]
    },
    options: {
      onClick: (event, elements) => {
        if (elements && elements.length > 0) {
          showMonthExpenses(elements[0].index, currentYear, false);
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => 'Team Spend: ' + formatAmount(ctx.raw, userCurrency) } }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              if (userCurrency === "IDR") return value >= 1000000 ? (value/1000000)+'M' : (value >= 1000 ? (value/1000)+'K' : value);
              else if (userCurrency === "INR") return value >= 100000 ? (value/100000)+'L' : (value >= 1000 ? (value/1000)+'K' : value);
              else return value >= 1000 ? (value/1000)+'K' : value;
            }
          }
        }
      }
    }
  });

  // Category doughnut
  const catSums = {};
  expenses.forEach(e => {
    catSums[e.category] = (catSums[e.category] || 0) + convertCurrency(e.amount, e.currency || "IDR", userCurrency);
  });

  const ctxCat = document.getElementById("fin-chart-categories").getContext("2d");
  if (charts["fin-categories"]) charts["fin-categories"].destroy();
  charts["fin-categories"] = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: Object.keys(catSums),
      datasets: [{ data: Object.values(catSums), backgroundColor: ['#4f46e5','#10b981','#f59e0b','#3b82f6','#ec4899','#8b5cf6'] }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatAmount(ctx.raw, userCurrency) } } }
    }
  });
}

// ================= SUBTAB NAVIGATION & HISTORY RENDERERS =================

function switchFinVerifySubtab(tabKey) {
  const btnPending = document.getElementById("fin-verify-btn-pending");
  const btnHistory = document.getElementById("fin-verify-btn-history");
  const subPending = document.getElementById("fin-verify-subtab-pending");
  const subHistory = document.getElementById("fin-verify-subtab-history");

  if (!btnPending || !btnHistory) return;

  if (tabKey === "pending") {
    btnPending.className = "btn btn-primary";
    btnHistory.className = "btn btn-secondary";
    if (subPending) subPending.style.display = "block";
    if (subHistory) subHistory.style.display = "none";
    renderFinPendingReports();
  } else {
    btnPending.className = "btn btn-secondary";
    btnHistory.className = "btn btn-primary";
    if (subPending) subPending.style.display = "none";
    if (subHistory) subHistory.style.display = "block";
    renderFinVerifyHistoryTable();
  }
}

function renderFinVerifyHistoryTable() {
  const container = document.getElementById("fin-verify-history-table-body");
  if (!container) return;

  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();

  const historyReports = reports.filter(r => r.status !== "DRAFT" && r.status !== "PENDING_MANAGER");

  container.innerHTML = "";
  if (historyReports.length === 0) {
    container.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No verification history available.</td></tr>`;
    return;
  }

  const sorted = [...historyReports].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

  sorted.forEach(r => {
    const folderExpenses = expenses.filter(e => e.reportId === r.id);
    const cleanRange = sanitizeReportDateRange(r.startDate, r.endDate, folderExpenses);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="openFinReportApprovalModal('${r.id}')"><i class="fa-solid fa-folder"></i> ${r.id}</td>
      <td style="font-weight: 600; cursor: pointer;" onclick="openFinReportApprovalModal('${r.id}')">${r.title}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td>${formatDate(cleanRange.startDate)} - ${formatDate(cleanRange.endDate)}</td>
      <td>${r.approver || "Not Set"}</td>
      <td>${r.verifier || "Not Set"}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(r.totalAmount, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge ${r.status.toLowerCase()}">${r.status.replace(/_/g, " ")}</span></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="openFinReportApprovalModal('${r.id}')">View</button>
      </td>
    `;
    container.appendChild(row);
  });
}

function switchFinPaymentSubtab(tabKey) {
  const btnPending = document.getElementById("fin-pay-btn-pending");
  const btnHistory = document.getElementById("fin-pay-btn-history");
  const subPending = document.getElementById("fin-pay-subtab-pending");
  const subHistory = document.getElementById("fin-pay-subtab-history");

  if (!btnPending || !btnHistory) return;

  if (tabKey === "pending") {
    btnPending.className = "btn btn-primary";
    btnHistory.className = "btn btn-secondary";
    if (subPending) subPending.style.display = "block";
    if (subHistory) subHistory.style.display = "none";
    renderPaymentProcessingTable();
  } else {
    btnPending.className = "btn btn-secondary";
    btnHistory.className = "btn btn-primary";
    if (subPending) subPending.style.display = "none";
    if (subHistory) subHistory.style.display = "block";
    renderFinPaymentHistoryTable();
  }
}

function renderFinPaymentHistoryTable() {
  const container = document.getElementById("fin-pay-history-table-body");
  if (!container) return;

  const reimbursements = expenseDb.getTable("reimbursements") || [];
  container.innerHTML = "";

  if (reimbursements.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No completed settlement history records.</td></tr>`;
    return;
  }

  const sorted = [...reimbursements].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

  sorted.forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--text-muted);">${r.id}</td>
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${r.expenseId}')">${r.expenseId}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td style="font-weight: 600; text-align: right;">${formatIDR(r.amount)}</td>
      <td>${r.paymentMethod}</td>
      <td>${formatDate(r.paymentDate)}</td>
      <td style="text-align: center;"><span class="status-badge approved">PAID</span></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${r.expenseId}')">View</button>
      </td>
    `;
    container.appendChild(row);
  });
}

function switchFinReimSubtab(tabKey) {
  const btnTracking = document.getElementById("fin-reim-btn-tracking");
  const btnFolders = document.getElementById("fin-reim-btn-folders");
  const subTracking = document.getElementById("fin-reim-subtab-tracking");
  const subFolders = document.getElementById("fin-reim-subtab-folders");

  if (!btnTracking || !btnFolders) return;

  if (tabKey === "tracking") {
    btnTracking.className = "btn btn-primary";
    btnFolders.className = "btn btn-secondary";
    if (subTracking) subTracking.style.display = "block";
    if (subFolders) subFolders.style.display = "none";
    renderReimbursementTrackingTable();
  } else {
    btnTracking.className = "btn btn-secondary";
    btnFolders.className = "btn btn-primary";
    if (subTracking) subTracking.style.display = "none";
    if (subFolders) subFolders.style.display = "block";
    renderFinReimFoldersTable();
  }
}

function renderFinReimFoldersTable() {
  const container = document.getElementById("fin-reim-folders-table-body");
  if (!container) return;

  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();

  const paidReports = reports.filter(r => r.status === "PAID");

  container.innerHTML = "";
  if (paidReports.length === 0) {
    container.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No fully paid/reimbursed expense folders yet.</td></tr>`;
    return;
  }

  const sorted = [...paidReports].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

  sorted.forEach(r => {
    const folderExpenses = expenses.filter(e => e.reportId === r.id);
    const cleanRange = sanitizeReportDateRange(r.startDate, r.endDate, folderExpenses);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="openFinReportApprovalModal('${r.id}')"><i class="fa-solid fa-folder"></i> ${r.id}</td>
      <td style="font-weight: 600; cursor: pointer;" onclick="openFinReportApprovalModal('${r.id}')">${r.title}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td>${formatDate(cleanRange.startDate)} - ${formatDate(cleanRange.endDate)}</td>
      <td>${r.approver || "Not Set"}</td>
      <td>${r.verifier || "Not Set"}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(r.totalAmount, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge approved">PAID</span></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="openFinReportApprovalModal('${r.id}')">View</button>
      </td>
    `;
    container.appendChild(row);
  });
}

// ================= FINANCE VERIFICATION & FOLDER APPROVALS =================

let activeFinReportId = null;

function renderFinPendingReports() {
  const container = document.getElementById("fin-pending-reports-table-body");
  if (!container) return;

  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();

  const pendingReports = reports.filter(r => r.status === "PENDING_FINANCE");

  container.innerHTML = "";
  if (pendingReports.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No pending expense folders awaiting finance verification.</td></tr>`;
    return;
  }

  const sorted = [...pendingReports].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

  sorted.forEach(r => {
    const folderExpenses = expenses.filter(e => e.reportId === r.id);
    const cleanRange = sanitizeReportDateRange(r.startDate, r.endDate, folderExpenses);
    let currentTotal = 0;
    folderExpenses.forEach(e => {
      currentTotal += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    });

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="openFinReportApprovalModal('${r.id}')"><i class="fa-solid fa-folder"></i> ${r.id}</td>
      <td style="font-weight: 600; cursor: pointer;" onclick="openFinReportApprovalModal('${r.id}')">${r.title}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td>${formatDate(cleanRange.startDate)} - ${formatDate(cleanRange.endDate)}</td>
      <td style="text-align: center;"><span class="badge" style="background: rgba(79,70,229,0.1); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-weight: 700;">${folderExpenses.length} items</span></td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(currentTotal, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge pending_finance">PENDING FINANCE</span></td>
      <td style="text-align: center;">
        <button class="btn btn-primary btn-sm" onclick="openFinReportApprovalModal('${r.id}')"><i class="fa-solid fa-folder-open"></i> Review &amp; Verify Folder</button>
      </td>
    `;
    container.appendChild(row);
  });
}

function openFinReportApprovalModal(reportId) {
  activeFinReportId = reportId;
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  const userCurrency = getUserCurrency();
  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === reportId);
  const cleanRange = sanitizeReportDateRange(report.startDate, report.endDate, folderExpenses);

  document.getElementById("fin-report-id").innerText = report.id;
  document.getElementById("fin-report-title").innerHTML = `<i class="fa-solid fa-folder-open"></i> Finance Folder Verification: ${report.title} (${report.id})`;
  document.getElementById("fin-report-employee").innerText = report.employeeName;
  document.getElementById("fin-report-dates").innerText = `${formatDate(cleanRange.startDate)} to ${formatDate(cleanRange.endDate)}`;

  let totalSum = 0;
  folderExpenses.forEach(e => {
    totalSum += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
  });
  document.getElementById("fin-report-total").innerText = formatAmount(totalSum, userCurrency);

  const container = document.getElementById("fin-report-expenses-table-body");
  container.innerHTML = "";

  if (folderExpenses.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No expenses inside this folder.</td></tr>`;
  } else {
    const sorted = [...folderExpenses].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

    sorted.forEach(e => {
      const row = document.createElement("tr");
      const policies = expenseDb.getTable("expensePolicies");
      const matchedPolicy = policies.find(p => p.type.toLowerCase() === e.type.toLowerCase());
      let policyAlert = `<span style="color: var(--approved-color);"><i class="fa-solid fa-circle-check"></i> Clean</span>`;
      if (matchedPolicy && e.amount > matchedPolicy.limit) {
        policyAlert = `<span style="color: var(--pending-color); font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Over budget</span>`;
      }

      const actionButtons = (e.status === "PENDING_FINANCE" || e.status === "APPROVED") ? `
        <div class="action-buttons" style="justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${e.id}')"><i class="fa-solid fa-receipt"></i> View</button>
          <button class="btn btn-primary btn-sm" onclick="verifyFolderExpenseItem('${e.id}')">Verify</button>
          <button class="btn btn-danger btn-sm" onclick="financeRejectDirect('${e.id}')">Reject</button>
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
        <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace(/_/g, " ")}</span></td>
        <td style="text-align: center;">${actionButtons}</td>
      `;
      container.appendChild(row);
    });
  }

  document.getElementById("fin-report-approval-overlay").classList.add("active");
}

function closeFinReportApprovalModal() {
  document.getElementById("fin-report-approval-overlay").classList.remove("active");
  activeFinReportId = null;
  refreshUI();
}

function verifyFolderExpenseItem(expId) {
  expenseDb.updateRecord("expenses", "id", expId, {
    status: "FINANCE_APPROVED",
    remarks: `Verified by Finance ${currentUser.name}`
  });
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Finance Verify Folder Item", `Finance verified item ${expId} in folder ${activeFinReportId}.`);
  showToast(`Item ${expId} verified for payment settlement!`, "success");
  
  if (activeFinReportId) {
    updateReportOverallStatus(activeFinReportId);
    openFinReportApprovalModal(activeFinReportId);
  }
}

function verifyAllFolderExpenses() {
  if (!activeFinReportId) return;
  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === activeFinReportId && (e.status === "PENDING_FINANCE" || e.status === "APPROVED"));
  
  if (folderExpenses.length === 0) {
    showToast("All items in this folder have already been verified.", "info");
    return;
  }

  folderExpenses.forEach(e => {
    expenseDb.updateRecord("expenses", "id", e.id, {
      status: "FINANCE_APPROVED",
      remarks: `Batch verified by Finance ${currentUser.name}`
    });
  });

  updateReportOverallStatus(activeFinReportId);
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Finance Verify Folder All", `Batch verified all items in folder ${activeFinReportId}.`);
  showToast(`All items in folder ${activeFinReportId} verified & sent to Payment Settlement queue!`, "success");
  openFinReportApprovalModal(activeFinReportId);
}

function updateReportOverallStatus(reportId) {
  if (!reportId) return;
  const reports = expenseDb.getTable("reports");
  const report = reports.find(r => r.id === reportId);
  if (!report) return;

  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === reportId);
  if (folderExpenses.length === 0) return;

  const statuses = folderExpenses.map(e => e.status);
  const hasPendingManager = statuses.some(s => s === "PENDING_MANAGER");
  const hasPendingFinance = statuses.some(s => s === "PENDING_FINANCE" || s === "APPROVED");
  const allPaid = statuses.every(s => s === "PAID");
  const allFinanceApproved = statuses.every(s => s === "FINANCE_APPROVED" || s === "PAID");
  const allRejected = statuses.every(s => s === "MANAGER_REJECTED" || s === "FINANCE_REJECTED");

  let newReportStatus = report.status;
  if (allPaid) {
    newReportStatus = "PAID";
  } else if (allFinanceApproved) {
    newReportStatus = "FINANCE_APPROVED";
  } else if (hasPendingFinance) {
    newReportStatus = "PENDING_FINANCE";
  } else if (hasPendingManager) {
    newReportStatus = "PENDING_MANAGER";
  } else if (allRejected) {
    newReportStatus = "MANAGER_REJECTED";
  } else {
    newReportStatus = "PARTIALLY_APPROVED";
  }

  expenseDb.updateRecord("reports", "id", reportId, { status: newReportStatus });
}

function renderVerificationTable() {
  const container = document.getElementById("tbl-finance-verify");
  if (!container) return;

  const expenses = expenseDb.getTable("expenses");
  const pendingVerify = expenses.filter(e => e.status === "PENDING_FINANCE");
  const userCurrency = getUserCurrency();

  container.innerHTML = "";

  if (pendingVerify.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No claims awaiting finance verification.</td></tr>`;
    return;
  }

  [...pendingVerify].sort((a, b) => {
    const dDiff = new Date(b.date) - new Date(a.date);
    if (dDiff !== 0) return dDiff;
    return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
  }).forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td><strong>${e.employeeName}</strong></td>
      <td>${e.category}</td>
      <td>${e.type}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
      <td>${e.paymentMethod}</td>
      <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="text-align: center;">
        <div class="action-buttons" style="justify-content: center;">
          <button class="btn btn-primary btn-sm" onclick="financeVerifyDirect('${e.id}')">Verify</button>
          <button class="btn btn-danger btn-sm" onclick="financeRejectDirect('${e.id}')">Reject</button>
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

// ================= PAYMENT PROCESSING TABLE =================

function renderPaymentProcessingTable() {
  const expenses = expenseDb.getTable("expenses");
  const verifiedList = expenses.filter(e => e.status === "FINANCE_APPROVED");
  const userCurrency = getUserCurrency();

  const container = document.getElementById("tbl-payment-processing");
  container.innerHTML = "";

  if (verifiedList.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No verified claims ready for payment processing.</td></tr>`;
    return;
  }

  [...verifiedList].sort((a, b) => {
    const dDiff = new Date(b.date) - new Date(a.date);
    if (dDiff !== 0) return dDiff;
    return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
  }).forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td><strong>${e.employeeName}</strong></td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
      <td>${e.paymentMethod}</td>
      <td style="text-align: center;"><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="text-align: center;">
        <button class="btn btn-success btn-sm" onclick="financeProcessPayout('${e.id}')">
          <i class="fa-solid fa-money-bill-wave"></i> Settle Payout
        </button>
      </td>
    `;
    container.appendChild(row);
  });
}

// ================= REIMBURSEMENT TRACKING TABLE =================

function renderReimbursementTrackingTable(records = null) {
  if (!records) records = expenseDb.getTable("reimbursements");
  const container = document.getElementById("tbl-reimbursement-track");
  if (!container) return;
  container.innerHTML = "";

  if (!records || records.length === 0) {
    container.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No historical paid disbursements found.</td></tr>`;
    return;
  }

  const expenses = expenseDb.getTable("expenses") || [];

  [...records].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)).forEach(r => {
    const exp = expenses.find(e => e.id === r.expenseId);
    const folderId = exp && exp.reportId ? exp.reportId : "Direct";

    const folderCell = (folderId !== "Direct" && folderId !== "N/A")
      ? `<span style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="openFinReportApprovalModal('${folderId}')"><i class="fa-solid fa-folder"></i> ${folderId}</span>`
      : `<span style="color: var(--text-muted); font-style: italic;">Individual</span>`;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--text-muted);">${r.id}</td>
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${r.expenseId}')">${r.expenseId}</td>
      <td>${folderCell}</td>
      <td><strong>${r.employeeName}</strong></td>
      <td style="font-weight: 600; text-align: right;">${formatIDR(r.amount)}</td>
      <td>${r.paymentMethod}</td>
      <td>${formatDate(r.paymentDate)}</td>
      <td style="text-align: center;"><span class="status-badge approved">${r.status}</span></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="viewExpenseDetails('${r.expenseId}')"><i class="fa-solid fa-eye"></i> View</button>
      </td>
    `;
    container.appendChild(row);
  });
}

function filterReimbursementsTable(query) {
  const records = expenseDb.getTable("reimbursements");
  const filtered = records.filter(r =>
    r.id.toLowerCase().includes(query.toLowerCase()) ||
    r.expenseId.toLowerCase().includes(query.toLowerCase()) ||
    r.employeeName.toLowerCase().includes(query.toLowerCase()) ||
    r.paymentMethod.toLowerCase().includes(query.toLowerCase()) ||
    r.paymentDate.toLowerCase().includes(query.toLowerCase()) ||
    r.amount.toString().includes(query)
  );
  renderReimbursementTrackingTable(filtered);
}

// ================= FINANCE ACTIONS =================

function financeVerifyDirect(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  expenseDb.updateRecord("expenses", "id", expId, { status: "FINANCE_APPROVED" });
  if (expense && expense.reportId) {
    updateReportOverallStatus(expense.reportId);
  }
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Verify Expense", `Finance verified claim ${expId}.`);
  showToast(`Expense ${expId} verified for payout.`, "success");
  refreshUI();
}

function financeRejectDirect(expId) {
  if (confirm(`Reject expense claim ${expId} from settlement queue?`)) {
    const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
    expenseDb.updateRecord("expenses", "id", expId, { status: "FINANCE_REJECTED", remarks: "Finance Verification Failed." });
    if (expense && expense.reportId) {
      updateReportOverallStatus(expense.reportId);
    }
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Finance Reject", `Finance rejected claim ${expId}.`);
    showToast(`Claim ${expId} rejected.`, "error");
    refreshUI();
  }
}

function financeProcessPayout(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  if (!expense) return;

  expenseDb.updateRecord("expenses", "id", expId, { status: "PAID", remarks: "Settled via ERP bank clearance." });
  if (expense.reportId) {
    updateReportOverallStatus(expense.reportId);
  }

  const newReim = {
    id: "REIM" + (expenseDb.getTable("reimbursements").length + 1),
    expenseId: expId,
    employeeId: expense.employeeId,
    employeeName: expense.employeeName,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod,
    paymentDate: new Date().toISOString().split("T")[0],
    status: "PAID"
  };
  expenseDb.addRecord("reimbursements", newReim);
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Payout Settled", `Cleared payout for ${expId} to ${expense.employeeName}.`);
  showToast(`Payout cleared for ${expId}! Status updated to Paid.`, "success");
  refreshUI();
}

// ================= MY PERSONAL DASHBOARD =================

function refreshDashboard() {
  const expenses = expenseDb.getTable("expenses");
  const myExpenses = expenses.filter(e => e.employeeId === currentUser.employeeId);
  const userCurrency = getUserCurrency();

  let approvedSum = 0, pendingSum = 0, rejectedSum = 0;

  myExpenses.forEach(e => {
    const amt = convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    if (["APPROVED","FINANCE_APPROVED","PAID","REIMBURSEMENT_PENDING"].includes(e.status)) approvedSum += amt;
    else if (["SUBMITTED","PENDING_MANAGER","PENDING_FINANCE","UNREPORTED"].includes(e.status)) pendingSum += amt;
    else if (["MANAGER_REJECTED","FINANCE_REJECTED"].includes(e.status)) rejectedSum += amt;
  });

  const totalSum = approvedSum + pendingSum + rejectedSum;
  document.getElementById("db-kpi-total").innerText = formatAmount(totalSum, userCurrency);
  document.getElementById("db-kpi-approved").innerText = formatAmount(approvedSum, userCurrency);
  document.getElementById("db-kpi-pending").innerText = formatAmount(pendingSum, userCurrency);
  document.getElementById("db-kpi-rejected").innerText = formatAmount(rejectedSum, userCurrency);

  // Monthly bar chart
  const selectedYear = parseInt(document.getElementById("dashboard-year-select").value) || new Date().getFullYear();
  const monthlyData = Array(12).fill(0);
  myExpenses.forEach(e => {
    const expDate = new Date(e.date);
    if (expDate.getFullYear() === selectedYear && !["DRAFT","CANCELLED","MANAGER_REJECTED","FINANCE_REJECTED"].includes(e.status)) {
      monthlyData[expDate.getMonth()] += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    }
  });

  const ctxMonthly = document.getElementById("chart-monthly").getContext("2d");
  if (charts["personal-monthly"]) charts["personal-monthly"].destroy();
  charts["personal-monthly"] = new Chart(ctxMonthly, {
    type: 'bar',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets: [{ label: 'My Spend', data: monthlyData, backgroundColor: '#4f46e5', borderRadius: 4 }]
    },
    options: {
      onClick: (event, elements) => {
        if (elements && elements.length > 0) showMonthExpenses(elements[0].index, selectedYear, true);
      },
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => 'My Spend: ' + formatAmount(ctx.raw, userCurrency) } } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => v >= 1000000 ? (v/1000000)+'M' : (v >= 1000 ? (v/1000)+'K' : v) } } }
    }
  });

  // Category progress bars
  const catSums = {};
  myExpenses.forEach(e => {
    if (!["DRAFT","CANCELLED","MANAGER_REJECTED","FINANCE_REJECTED"].includes(e.status)) {
      catSums[e.category] = (catSums[e.category] || 0) + convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    }
  });
  const progressContainer = document.getElementById("db-category-progress");
  progressContainer.innerHTML = "";
  const categories = expenseDb.getTable("expenseCategories").filter(c => c.status === "Active");
  const totalCat = categories.reduce((acc, cat) => acc + (catSums[cat.name] || 0), 0);
  categories.forEach(cat => {
    const sum = catSums[cat.name] || 0;
    const pct = totalCat > 0 ? Math.round((sum / totalCat) * 100) : 0;
    progressContainer.innerHTML += `
      <div class="progress-item">
        <div class="progress-label-row">
          <span class="progress-label"><i class="fa-solid fa-${cat.icon || 'tag'}"></i> ${cat.name}</span>
          <span class="progress-percentage">${pct}%</span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${pct}%"></div></div>
      </div>
    `;
  });

  // Recent Activity (Last 10 Days)
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  tenDaysAgo.setHours(0, 0, 0, 0);
  const recent = [...myExpenses.filter(e => new Date(e.date) >= tenDaysAgo)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recentContainer = document.getElementById("db-recent-expenses-body");
  recentContainer.innerHTML = "";
  if (recent.length === 0) {
    recentContainer.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expenses in the last 10 days.</td></tr>`;
  } else {
    recent.forEach(e => {
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

// ================= MY EXPENSES TABLE =================

function renderMyExpensesTable() {
  const expenses = expenseDb.getTable("expenses");
  const userExpenses = [...expenses.filter(e => e.employeeId === currentUser.employeeId)].sort((a, b) => new Date(b.date) - new Date(a.date));
  const container = document.getElementById("my-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";
  if (userExpenses.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">You have not filed any expenses.</td></tr>`;
    return;
  }
  userExpenses.forEach(e => {
    const row = document.createElement("tr");
    const canCancel = ["SUBMITTED","PENDING_MANAGER","PENDING_FINANCE","CLARIFICATION_REQUIRED"].includes(e.status);
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

function filterHistoryTable(query) {
  const expenses = expenseDb.getTable("expenses").filter(e => e.employeeId === currentUser.employeeId);
  const filtered = expenses.filter(e =>
    e.id.toLowerCase().includes(query.toLowerCase()) ||
    e.date.toLowerCase().includes(query.toLowerCase()) ||
    e.project.toLowerCase().includes(query.toLowerCase()) ||
    e.category.toLowerCase().includes(query.toLowerCase()) ||
    e.amount.toString().includes(query) ||
    (e.remarks && e.remarks.toLowerCase().includes(query.toLowerCase())) ||
    e.status.toLowerCase().includes(query.toLowerCase())
  );
  const container = document.getElementById("my-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";
  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No matching transactions found.</td></tr>`;
    return;
  }
  [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(e => {
    const row = document.createElement("tr");
    const canCancel = ["SUBMITTED","PENDING_MANAGER","PENDING_FINANCE","CLARIFICATION_REQUIRED"].includes(e.status);
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

// ================= ADD EXPENSE FORM =================

function setupAddExpenseForm() {
  if (!editingDraftId) {
    document.getElementById("expense-claim-form").reset();
    document.getElementById("upload-status-text").innerText = "Drag & drop receipt image or PDF here, or click to upload";
    document.getElementById("upload-box").style.borderColor = "var(--border-color)";
    document.getElementById("form-exp-receipt-url").value = "";
    const verdict = document.getElementById("policy-verdict-indicator");
    if (verdict) verdict.innerHTML = "";
  }

  const countries = expenseDb.getTable("countries").filter(c => c.status === "Active");
  const countrySelect = document.getElementById("form-exp-country");
  countrySelect.innerHTML = `<option value="">Select Country</option>`;
  countries.forEach(c => countrySelect.innerHTML += `<option value="${c.code}">${c.name}</option>`);

  const today = new Date().toISOString().split("T")[0];
  if (!editingDraftId) document.getElementById("form-exp-date").value = today;

  populateFormFolderDropdown();
  cascadeCountry();
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
  const projects = expenseDb.getTable("projects").filter(p => p.status === "Active" && (!p.country || p.country === countryCode));
  const departments = expenseDb.getTable("departments").filter(d => d.status === "Active");

  const projSelect = document.getElementById("form-exp-project");
  projSelect.innerHTML = `<option value="">Select Project</option>`;
  projects.forEach(p => projSelect.innerHTML += `<option value="${p.code}">${p.code} - ${p.name}</option>`);

  const deptSelect = document.getElementById("form-exp-department");
  deptSelect.innerHTML = `<option value="">Select Department</option>`;
  departments.forEach(d => deptSelect.innerHTML += `<option value="${d.name}">${d.name}</option>`);

  const categories = expenseDb.getTable("expenseCategories").filter(c => c.status === "Active");
  const catSelect = document.getElementById("form-exp-category");
  catSelect.innerHTML = `<option value="">Select Category</option>`;
  categories.forEach(c => catSelect.innerHTML += `<option value="${c.name}">${c.name}</option>`);
}

function cascadeCategory() {
  const catName = document.getElementById("form-exp-category").value;
  const categories = expenseDb.getTable("expenseCategories").filter(c => c.status === "Active");
  const cat = categories.find(c => c.name === catName);

  const typeSelect = document.getElementById("form-exp-type");
  typeSelect.innerHTML = `<option value="">Select Type</option>`;
  if (cat && cat.types) {
    cat.types.forEach(t => typeSelect.innerHTML += `<option value="${t}">${t}</option>`);
  }
  evaluatePolicyLimit();
}

function evaluatePolicyLimit() {
  const amount = parseFloat(document.getElementById("form-exp-amount").value);
  const type = document.getElementById("form-exp-type").value;
  const currency = document.getElementById("form-exp-currency").value;
  const verdict = document.getElementById("policy-verdict-indicator");
  if (!verdict) return;
  if (!amount || !type) { verdict.innerHTML = ""; return; }

  const policies = expenseDb.getTable("policies");
  const matched = policies.find(p => p.type === type && p.status === "Active");
  if (!matched) { verdict.innerHTML = ""; return; }

  const limitInCurrency = convertCurrency(matched.limit, "IDR", currency);
  if (amount > limitInCurrency) {
    verdict.innerHTML = `<span style="color: var(--rejected-color); font-size: 12px;"><i class="fa-solid fa-triangle-exclamation"></i> Over policy limit (${formatAmount(limitInCurrency, currency)}). Flag will be raised.</span>`;
  } else {
    verdict.innerHTML = `<span style="color: var(--approved-color); font-size: 12px;"><i class="fa-solid fa-circle-check"></i> Within policy limit (${formatAmount(limitInCurrency, currency)}). Clean submission.</span>`;
  }
}

function handleExpenseSubmit(event) {
  event.preventDefault();
  const amount = parseFloat(document.getElementById("form-exp-amount").value);
  if (!amount || amount <= 0) { showToast("Amount must be greater than zero.", "error"); return; }

  const date = document.getElementById("form-exp-date").value;
  const country = document.getElementById("form-exp-country").value;
  const project = document.getElementById("form-exp-project").value;
  const department = document.getElementById("form-exp-department").value;
  const category = document.getElementById("form-exp-category").value;
  const type = document.getElementById("form-exp-type").value;
  const currency = document.getElementById("form-exp-currency").value;
  const paymentMethod = document.getElementById("form-exp-payment").value;
  const description = document.getElementById("form-exp-desc").value.trim();
  const remarks = document.getElementById("form-exp-remarks").value.trim();
  const receiptUrl = document.getElementById("form-exp-receipt-url").value;
  const selectedFolderId = document.getElementById("form-exp-report-folder")?.value || null;

  const policies = expenseDb.getTable("policies");
  const matched = policies.find(p => p.type === type && p.status === "Active");
  const limitIDR = matched ? matched.limit : Infinity;
  const amountInIDR = convertCurrency(amount, currency, "IDR");
  const isOverBudget = amountInIDR > limitIDR;

  if (editingDraftId) {
    expenseDb.updateRecord("expenses", "id", editingDraftId, {
      date, country, project, department, category, type,
      amount, currency, paymentMethod, description, remarks,
      receiptUrl, status: "PENDING_FINANCE", reportId: selectedFolderId,
      policyFlag: isOverBudget ? "Over budget" : "Clean"
    });
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Submit Draft", `Finance user submitted draft ${editingDraftId}.`);
    showToast(`Draft ${editingDraftId} submitted to Finance Verification.`, "success");
    editingDraftId = null;
  } else {
    const expenses = expenseDb.getTable("expenses");
    const newId = "EXP" + String(expenses.length + 1).padStart(3, "0");
    const newExpense = {
      id: newId, date, country, project, department, category, type,
      amount, currency, paymentMethod, description, remarks,
      receiptUrl, employeeId: currentUser.employeeId,
      employeeName: currentUser.name,
      status: "PENDING_FINANCE",
      reportId: selectedFolderId,
      policyFlag: isOverBudget ? "Over budget" : "Clean",
      dateCreated: new Date().toISOString().split("T")[0]
    };
    expenseDb.addRecord("expenses", newExpense);
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Submit Expense", `Finance user submitted new expense ${newId}.`);
    showToast(`Expense ${newId} submitted directly to Finance Verification queue.`, "success");
  }

  document.getElementById("expense-claim-form").reset();
  document.getElementById("form-exp-receipt-url").value = "";
  document.getElementById("upload-status-text").innerText = "Drag & drop receipt image or PDF here, or click to upload";
  document.getElementById("upload-box").style.borderColor = "var(--border-color)";
  navigateToTab("my-expenses");
}

function saveExpenseDraft() {
  const amount = parseFloat(document.getElementById("form-exp-amount").value) || 0;
  const date = document.getElementById("form-exp-date").value;
  const country = document.getElementById("form-exp-country").value;
  const project = document.getElementById("form-exp-project").value;
  const department = document.getElementById("form-exp-department").value;
  const category = document.getElementById("form-exp-category").value;
  const type = document.getElementById("form-exp-type").value;
  const currency = document.getElementById("form-exp-currency").value;
  const paymentMethod = document.getElementById("form-exp-payment").value;
  const description = document.getElementById("form-exp-desc").value.trim();
  const remarks = document.getElementById("form-exp-remarks").value.trim();
  const receiptUrl = document.getElementById("form-exp-receipt-url").value;

  if (editingDraftId) {
    expenseDb.updateRecord("expenses", "id", editingDraftId, {
      date, country, project, department, category, type,
      amount, currency, paymentMethod, description, remarks, receiptUrl
    });
    showToast(`Draft ${editingDraftId} updated.`, "success");
    editingDraftId = null;
  } else {
    const expenses = expenseDb.getTable("expenses");
    const newId = "EXP" + String(expenses.length + 1).padStart(3, "0");
    expenseDb.addRecord("expenses", {
      id: newId, date, country, project, department, category, type,
      amount, currency, paymentMethod, description, remarks, receiptUrl,
      employeeId: currentUser.employeeId, employeeName: currentUser.name,
      status: "DRAFT", policyFlag: "Clean",
      dateCreated: new Date().toISOString().split("T")[0]
    });
    showToast(`Draft ${newId} saved.`, "success");
  }
  navigateToTab("my-expenses");
}

function editDraft(expId) {
  const expense = expenseDb.getTable("expenses").find(e => e.id === expId);
  if (!expense) return;
  editingDraftId = expense.id;
  navigateToTab("add-expense");
  setTimeout(() => {
    document.getElementById("form-exp-date").value = expense.date;
    document.getElementById("form-exp-country").value = expense.country || "";
    cascadeCountry();
    setTimeout(() => {
      document.getElementById("form-exp-project").value = expense.project || "";
      document.getElementById("form-exp-department").value = expense.department || "";
      document.getElementById("form-exp-category").value = expense.category || "";
      cascadeCategory();
      setTimeout(() => {
        document.getElementById("form-exp-type").value = expense.type || "";
        document.getElementById("form-exp-amount").value = expense.amount > 0 ? expense.amount : "";
        document.getElementById("form-exp-currency").value = expense.currency || "IDR";
        document.getElementById("form-exp-payment").value = expense.paymentMethod || "Cash";
        document.getElementById("form-exp-desc").value = expense.description || "";
        document.getElementById("form-exp-remarks").value = expense.remarks || "";
        document.getElementById("form-exp-receipt-url").value = expense.receiptUrl || "";
        if (expense.receiptUrl) {
          document.getElementById("upload-status-text").innerText = "Receipt file loaded!";
          document.getElementById("upload-box").style.borderColor = "var(--approved-color)";
        }
        evaluatePolicyLimit();
      }, 50);
    }, 50);
  }, 100);
}

function submitDraft(expId) {
  expenseDb.updateRecord("expenses", "id", expId, { status: "PENDING_FINANCE", remarks: "Submitted from draft." });
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Submit Draft", `Draft ${expId} submitted to Finance queue.`);
  showToast(`Draft ${expId} submitted to Finance Verification.`, "success");
  renderMyExpensesTable();
}

function cancelExpense(expId) {
  if (confirm(`Cancel expense ${expId}? This action cannot be undone.`)) {
    expenseDb.updateRecord("expenses", "id", expId, { status: "CANCELLED", remarks: "Cancelled by Finance user." });
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "Cancel Expense", `Expense ${expId} cancelled.`);
    showToast(`Expense ${expId} cancelled.`, "error");
    renderMyExpensesTable();
  }
}

// ================= EXPENSE DETAILS OVERLAY =================

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

// ================= MONTH EXPENSES OVERLAY =================

function showMonthExpenses(monthIndex, year, isPersonal = false) {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById("month-expenses-title").innerText = isPersonal
    ? `My Expenses for ${monthNames[monthIndex]} ${year}`
    : `Team Expenses for ${monthNames[monthIndex]} ${year}`;

  const expenses = expenseDb.getTable("expenses");
  const pool = isPersonal
    ? expenses.filter(e => e.employeeId === currentUser.employeeId)
    : expenses.filter(e => e.status !== "DRAFT");

  const filtered = pool.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === monthIndex &&
      !["DRAFT","CANCELLED","MANAGER_REJECTED","FINANCE_REJECTED"].includes(e.status);
  });

  const container = document.getElementById("month-expenses-table-body");
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No expenses recorded for this month.</td></tr>`;
  } else {
    [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(e => {
      const row = document.createElement("tr");
      row.style.cssText = "border-bottom: 1px solid var(--border-color); font-size: 12px; cursor: pointer;";
      row.innerHTML = `
        <td style="padding: 10px 6px; font-weight: 700; color: var(--primary);">${e.id}</td>
        <td style="padding: 10px 6px;">${formatDate(e.date)}</td>
        <td style="padding: 10px 6px;">${e.project || "-"}</td>
        <td style="padding: 10px 6px;">${e.category || "-"}</td>
        <td style="padding: 10px 6px;">${e.type || "-"}</td>
        <td style="padding: 10px 6px; font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
        <td style="padding: 10px 6px; text-align: center;"><span class="status-badge ${e.status.toLowerCase()}" style="font-size: 11px; padding: 3px 8px;">${e.status.replace("_", " ")}</span></td>
      `;
      row.onclick = () => { closeMonthExpenses(); viewExpenseDetails(e.id); };
      container.appendChild(row);
    });
  }
  document.getElementById("month-expenses-overlay").classList.add("active");
}

function closeMonthExpenses() {
  document.getElementById("month-expenses-overlay").classList.remove("active");
}

// ================= EXPENSE REPORTS =================

function initExpenseReportsPage() {
  switchReportTab("create-report-subtab");
  renderUnreportedExpensesTable();
  renderReportsHistoryTable();

  const users = expenseDb.getTable("users").filter(u => u.status === "Active" && u.employeeId !== currentUser.employeeId);
  const approverSel = document.getElementById("report-approver");
  const verifierSel = document.getElementById("report-verifier");
  approverSel.innerHTML = `<option value="">-- Select Approver --</option>`;
  verifierSel.innerHTML = `<option value="">-- Select Verifier --</option>`;
  users.forEach(u => {
    approverSel.innerHTML += `<option value="${u.name}">${u.name} (${u.role})</option>`;
    verifierSel.innerHTML += `<option value="${u.name}">${u.name} (${u.role})</option>`;
  });
}

function switchReportTab(tabId) {
  document.querySelectorAll(".report-tab-content").forEach(el => el.style.display = "none");
  const target = document.getElementById(tabId);
  if (target) target.style.display = "block";
  document.getElementById("tab-btn-create").className = tabId === "create-report-subtab" ? "btn btn-primary" : "btn btn-secondary";
  document.getElementById("tab-btn-history").className = tabId === "history-report-subtab" ? "btn btn-primary" : "btn btn-secondary";
}

function renderUnreportedExpensesTable() {
  const expenses = expenseDb.getTable("expenses");
  const unreported = expenses.filter(e => e.employeeId === currentUser.employeeId && e.status === "UNREPORTED" && !e.reportId);
  const container = document.getElementById("unreported-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";
  document.getElementById("select-all-expenses").checked = false;

  if (unreported.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No unreported expenses. Add expenses first.</td></tr>`;
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
  document.querySelectorAll(".expense-select-chk").forEach(chk => { chk.checked = masterCheckbox.checked; });
}

function handleReportSubmit(event) {
  event.preventDefault();
  const title = document.getElementById("report-title").value.trim();
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;
  const approver = document.getElementById("report-approver").value;
  const verifier = document.getElementById("report-verifier").value;

  const selectedExpIds = [...document.querySelectorAll(".expense-select-chk:checked")].map(c => c.value);
  if (selectedExpIds.length === 0) { showToast("Please select at least one expense.", "error"); return; }

  const expenses = expenseDb.getTable("expenses");
  const selected = expenses.filter(e => selectedExpIds.includes(e.id));
  const userCurrency = getUserCurrency();
  const totalAmount = selected.reduce((acc, e) => acc + convertCurrency(e.amount, e.currency || "IDR", userCurrency), 0);

  const reports = expenseDb.getTable("reports") || [];
  const newRptId = "RPT" + String(reports.length + 1).padStart(3, "0");

  const newReport = {
    id: newRptId, title, startDate, endDate, approver, verifier,
    employeeId: currentUser.employeeId, employeeName: currentUser.name,
    totalAmount, status: "PENDING_FINANCE",
    dateCreated: new Date().toISOString().split("T")[0],
    expenseIds: selectedExpIds
  };
  expenseDb.addRecord("reports", newReport);

  selectedExpIds.forEach(expId => {
    expenseDb.updateRecord("expenses", "id", expId, { reportId: newRptId, status: "PENDING_FINANCE" });
  });

  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Submit Report", `Finance user submitted report ${newRptId}.`);
  showToast(`Report ${newRptId} submitted directly to Finance Verification!`, "success");
  switchReportTab("history-report-subtab");
  renderReportsHistoryTable();
}

function renderReportsHistoryTable() {
  let reports = expenseDb.getTable("reports") || [];
  const userCurrency = getUserCurrency();
  const userReports = reports.filter(r => r.employeeId === currentUser.employeeId);
  const container = document.getElementById("reports-history-table-body");
  if (!container) return;
  container.innerHTML = "";

  if (userReports.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No reports created yet.</td></tr>`;
    return;
  }

  [...userReports].sort((a, b) => b.id.localeCompare(a.id)).forEach(r => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${r.id}</td>
      <td style="font-weight: 600;">${r.title}</td>
      <td>${formatDate(r.startDate)} - ${formatDate(r.endDate)}</td>
      <td>${r.approver}</td>
      <td>${r.verifier}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(r.totalAmount, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge ${r.status.toLowerCase()}">${r.status.replace("_", " ")}</span></td>
      <td style="text-align: center;"><button class="btn btn-secondary btn-sm" onclick="viewReportDetails('${r.id}')">View</button></td>
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

  const expenses = expenseDb.getTable("expenses").filter(e => e.reportId === report.id);
  const container = document.getElementById("report-expenses-details-body");
  container.innerHTML = "";

  expenses.forEach(e => {
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

// ================= OCR SCAN (MOCK) =================

function triggerMockOCR() {
  document.getElementById("ocr-scan-overlay").classList.add("active");
  startOcrCamera();
}

function startOcrCamera() {
  const video = document.getElementById("ocr-video");
  const placeholder = document.getElementById("ocr-placeholder");
  const laser = document.getElementById("ocr-laser");
  const capture = document.getElementById("btn-ocr-capture");
  const selectFile = document.getElementById("btn-ocr-select-file");
  const retry = document.getElementById("btn-ocr-retry");
  const status = document.getElementById("ocr-status-text");

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      video.srcObject = stream;
      video.style.display = "block";
      placeholder.style.display = "none";
      laser.style.display = "block";
      capture.style.display = "inline-flex";
      selectFile.style.display = "none";
      retry.style.display = "none";
      status.innerText = "Point camera at receipt and click Capture & Scan.";
    })
    .catch(() => {
      video.style.display = "none";
      placeholder.style.display = "flex";
      laser.style.display = "none";
      capture.style.display = "none";
      selectFile.style.display = "inline-flex";
      retry.style.display = "none";
      status.innerText = "Camera not available. Please select a receipt file instead.";
    });
}

function captureAndScanOCR() {
  const video = document.getElementById("ocr-video");
  const canvas = document.getElementById("ocr-canvas");
  const status = document.getElementById("ocr-status-text");
  const laser = document.getElementById("ocr-laser");

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);

  laser.style.display = "none";
  status.innerText = "Scanning receipt... Please wait.";

  setTimeout(() => {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
    document.getElementById("form-exp-receipt-url").value = dataUrl;
    document.getElementById("upload-status-text").innerText = "Receipt scanned successfully!";
    document.getElementById("upload-box").style.borderColor = "var(--approved-color)";

    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;

    autoFillFromOCR();
    closeOcrOverlay();
    showToast("Receipt scanned! Form fields auto-filled.", "success");
  }, 1500);
}

function triggerOcrFileSelect() {
  document.getElementById("ocr-file-input").click();
}

function handleOcrFileSelect(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const canvas = document.createElement("canvas");
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = (h / w) * maxDim; w = maxDim; }
        else { w = (w / h) * maxDim; h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.5);
      document.getElementById("form-exp-receipt-url").value = compressed;
      document.getElementById("upload-status-text").innerText = "Receipt file loaded from OCR!";
      document.getElementById("upload-box").style.borderColor = "var(--approved-color)";
      autoFillFromOCR();
      closeOcrOverlay();
      showToast("Receipt loaded! Form fields auto-filled.", "success");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

function autoFillFromOCR() {
  const today = new Date().toISOString().split("T")[0];
  if (!document.getElementById("form-exp-date").value) document.getElementById("form-exp-date").value = today;
}

function closeOcrOverlay() {
  const video = document.getElementById("ocr-video");
  if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
  document.getElementById("ocr-scan-overlay").classList.remove("active");
}

// ================= FILE UPLOAD =================

function triggerReceiptFileUpload() {
  document.getElementById("form-exp-receipt-file").click();
}

function handleReceiptFileSelect(input) {
  if (!input.files[0]) return;
  const file = input.files[0];
  if (file.size > 5 * 1024 * 1024) { showToast("File too large. Max 5MB allowed.", "error"); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 1000;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = (h / w) * maxDim; w = maxDim; }
        else { w = (w / h) * maxDim; h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.5);
      document.getElementById("form-exp-receipt-url").value = compressed;
      document.getElementById("upload-status-text").innerText = `Uploaded: ${file.name}`;
      document.getElementById("upload-box").style.borderColor = "var(--approved-color)";
    };
    img.onerror = () => {
      document.getElementById("form-exp-receipt-url").value = e.target.result;
      document.getElementById("upload-status-text").innerText = `Uploaded: ${file.name}`;
      document.getElementById("upload-box").style.borderColor = "var(--approved-color)";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// ================= TOAST NOTIFICATION =================

function showToast(message, type = "success") {
  const toast = document.getElementById("system-toast");
  const icon = document.getElementById("toast-icon");
  const text = document.getElementById("toast-message");
  text.innerText = message;
  toast.className = `alert-toast active ${type}`;
  icon.className = type === "success" ? "fa-solid fa-circle-check" : "fa-solid fa-circle-xmark";
  icon.style.color = type === "success" ? "var(--approved-color)" : "var(--rejected-color)";
  setTimeout(() => toast.classList.remove("active"), 4000);
}

// ================= SECURE LOGOUT =================

function logout() {
  expenseDb.addLog(currentUser.employeeId, currentUser.name, "Logout", "Session ended.");
  sessionStorage.removeItem("EXPENSE_SESSION");
  window.location.href = "login.html";
}
