// Employee Portal Controller Logic

// Get current session
const sessionData = sessionStorage.getItem("EXPENSE_SESSION");
const currentUser = JSON.parse(sessionData);

let activeTab = "dashboard";
let editingDraftId = null;

document.addEventListener("DOMContentLoaded", () => {
  initEmployeePortal();
});

function initEmployeePortal() {
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

  // Setup drag and drop file upload listeners
  initDragAndDropUpload();
  setupReportDateListeners();

  navigateToTab("dashboard");
}

function setupReportDateListeners() {
  const startInput = document.getElementById("report-start-date");
  const endInput = document.getElementById("report-end-date");
  if (!startInput || !endInput) return;

  startInput.addEventListener("change", () => {
    if (startInput.value) {
      endInput.min = startInput.value;
      if (endInput.value && endInput.value < startInput.value) {
        endInput.value = startInput.value;
      }
    }
  });

  endInput.addEventListener("change", () => {
    if (startInput.value && endInput.value && endInput.value < startInput.value) {
      alert("End Date cannot be earlier than Start Date.");
      endInput.value = startInput.value;
    }
  });
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
  const sections = ["dashboard", "my-expenses", "add-expense", "expense-reports"];
  sections.forEach(s => {
    const panel = document.getElementById(`view-${s}`);
    if (s === tabName) {
      panel.style.display = "block";
    } else {
      panel.style.display = "none";
    }
  });

  // Update headers
  const titles = {
    "dashboard": "Employee Dashboard Overview",
    "add-expense": "Submit Expense Claim",
    "expense-reports": "Expense Reports Desk",
    "my-expenses": "Personal Expense Ledger"
  };
  document.getElementById("page-title").innerText = titles[tabName] || "Employee Dashboard";
  
  if (tabName === "dashboard") {
    refreshDashboard();
  } else if (tabName === "add-expense") {
    setupAddExpenseForm();
  } else if (tabName === "expense-reports") {
    initExpenseReportsPage();
  } else if (tabName === "my-expenses") {
    renderMyExpensesTable();
  }
}

function refreshUI() {
  refreshKPIs();
  renderMyExpensesTable();
}

const EXCHANGE_RATES = {
  IDR: 1.0,
  INR: 175.0, // 1 INR = 175 IDR
  USD: 15000.0, // 1 USD = 15000 IDR
  EUR: 16500.0 // 1 EUR = 16500 IDR
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
  
  const amountInBase = amount * fromRate;
  return amountInBase / toRate;
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

// Personal KPIs Calculation
function refreshKPIs() {
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

  document.getElementById("kpi-total").innerText = formatAmount(totalSum, userCurrency);
  document.getElementById("kpi-approved").innerText = formatAmount(approvedSum, userCurrency);
  document.getElementById("kpi-pending").innerText = formatAmount(pendingSum, userCurrency);
  document.getElementById("kpi-rejected").innerText = formatAmount(rejectedSum, userCurrency);
}

// Render personal history ledger
function renderMyExpensesTable() {
  const expenses = expenseDb.getTable("expenses");
  const userExpenses = expenses.filter(e => e.employeeId === currentUser.employeeId);
  
  const container = document.getElementById("my-expenses-table-body");
  container.innerHTML = "";

  if (userExpenses.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">You have not filed any expenses.</td></tr>`;
    return;
  }

  // Sort descending by date and ID
  const sorted = [...userExpenses].sort((a, b) => {
    const dDiff = new Date(b.date) - new Date(a.date);
    if (dDiff !== 0) return dDiff;
    return b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' });
  });

  sorted.forEach(e => {
    const row = document.createElement("tr");
    const canCancel = e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "CLARIFICATION_REQUIRED";
    
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.project}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600;">${formatAmount(e.amount, e.currency)}</td>
      <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.remarks || "-"}</td>
      <td>
        <div class="action-buttons">
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
  
  // Switch to tab
  navigateToTab("add-expense");
  
  // Populate form fields
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
  
  if (expense.receiptUrl && expense.receiptUrl.trim() !== "" && expense.receiptUrl !== "receipt_attached.png") {
    if (expense.receiptUrl.startsWith("http") || expense.receiptUrl.startsWith("data:")) {
      imgElement.src = expense.receiptUrl;
    } else {
      const seededImages = {
        "receipt_flight.jpg": "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=500&auto=format&fit=crop&q=60",
        "receipt_hotel.jpg": "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60",
        "receipt_dinner.jpg": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=60",
        "receipt_stationery.png": "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=500&auto=format&fit=crop&q=60"
      };
      imgElement.src = seededImages[expense.receiptUrl] || "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&auto=format&fit=crop&q=60";
    }
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

// ================= FORM FILLING & CASCADING DROPDOWNS =================

function setupAddExpenseForm() {
  editingDraftId = null;
  document.getElementById("expense-claim-form").reset();
  document.getElementById("form-exp-date").valueAsDate = new Date();
  
  // Populate country dropdown
  const countries = expenseDb.getTable("countries").filter(c => c.status === "Active");
  const cSelect = document.getElementById("form-exp-country");
  cSelect.innerHTML = `<option value="">Select Country</option>`;
  countries.forEach(c => {
    cSelect.innerHTML += `<option value="${c.code}">${c.name}</option>`;
  });

  // Populate project dropdown (initially all active projects)
  const projects = expenseDb.getTable("projects").filter(p => p.status === "Active");
  const pSelect = document.getElementById("form-exp-project");
  pSelect.innerHTML = `<option value="">Select Project</option>`;
  projects.forEach(p => {
    pSelect.innerHTML += `<option value="${p.code}">${p.name}</option>`;
  });

  // Populate department dropdown (initially all active departments)
  const departments = expenseDb.getTable("departments").filter(d => d.status === "Active");
  const dSelect = document.getElementById("form-exp-department");
  dSelect.innerHTML = `<option value="">Select Department</option>`;
  departments.forEach(d => {
    dSelect.innerHTML += `<option value="${d.code}">${d.name}</option>`;
  });

  // Populate category dropdown
  const categories = expenseDb.getTable("expenseCategories").filter(cat => cat.status === "Active");
  const catSelect = document.getElementById("form-exp-category");
  catSelect.innerHTML = `<option value="">Select Category</option>`;
  categories.forEach(cat => {
    catSelect.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
  });

  // Default dropdown state for type (must select category first)
  document.getElementById("form-exp-type").innerHTML = `<option value="">Select Type (Select Category first)</option>`;
  
  // Populate Folder / Report dropdown
  populateFormFolderDropdown();

  // Clear indicator
  document.getElementById("policy-verdict-indicator").innerHTML = "";
  
  document.getElementById("upload-status-text").innerText = "Drag & drop receipt image or PDF here, or click to upload";
  document.getElementById("upload-box").style.borderColor = "var(--border-color)";
  document.getElementById("form-exp-receipt-file").value = "";
}

// Cascade Country -> Project (optional helper)
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
    // Repopulate all active projects if country is cleared
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

// Cascade Category -> Type
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

// Evaluate limits and Policies
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

// Form Submission Actions
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
    `${editingDraftId ? 'Updated' : 'Logged new'} claim ${expId} for ${formatIDR(amountVal)} (${typeVal})`
  );

  const msg = targetStatus === "DRAFT" 
    ? "Draft saved successfully!" 
    : "Expense added to pool. Attach it to an Expense Folder to submit for approval.";
  showToast(msg, "success");
  
  editingDraftId = null; // Reset draft state
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
  
  // Try to start the camera stream
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
  
  // Stop existing stream if any
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
      // Let the user know the camera was blocked and prompt them to select a file manually
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
  
  // Capture frame
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const capturedDataUrl = canvas.toDataURL("image/png");
  imgElement.src = capturedDataUrl;
  
  // Stop camera stream immediately
  stopOcrCamera();
  
  // Toggle UI
  video.style.display = "none";
  imgElement.style.display = "block";
  btnCapture.style.display = "none";
  btnRetry.style.display = "none";
  
  // Pick a random mock dataset to represent the "scanned result"
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
    
    // Switch to Add Expense tab
    navigateToTab("add-expense");
    
    // Fill in mock country and cascade
    document.getElementById("form-exp-country").value = "ID";
    cascadeCountry();
    
    // Fill in project and department
    document.getElementById("form-exp-project").value = "PRJ-JAK";
    cascadeProject();
    document.getElementById("form-exp-department").value = "IT";
    
    // Fill in category and type
    document.getElementById("form-exp-category").value = selection.category;
    cascadeCategory();
    document.getElementById("form-exp-type").value = selection.type;
    
    // Fill details
    document.getElementById("form-exp-amount").value = selection.amount;
    const merchant = selection.type === "Hotel" ? "Jakarta Hotel Mulia" : selection.type === "Flight" ? "Garuda Indonesia" : "Starbucks Coffee";
    document.getElementById("form-exp-desc").value = `Claim for ${merchant} - ${selection.desc}`;
    document.getElementById("form-exp-remarks").value = selection.remarks + " (Captured via Device Camera)";
    document.getElementById("form-exp-receipt-url").value = selection.customImg || selection.img;

    document.getElementById("upload-status-text").innerText = `Receipt scanned! File: captured_receipt.png (${formatIDR(selection.amount)})`;
    document.getElementById("upload-box").style.borderColor = "var(--approved-color)";

    evaluatePolicyLimit();
    showToast("Receipt captured and form data auto-filled!", "success");
    
    expenseDb.addLog(currentUser.employeeId, currentUser.name, "OCR Scan", `Parsed merchant invoice matching ${formatIDR(selection.amount)}.`);
  }, 2400);
}

function closeOcrScanner() {
  stopOcrCamera();
  document.getElementById("ocr-scan-overlay").classList.remove("active");
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
  window.location.href = "login.html";
}

// ================= EXPENSE REPORTS CONTROLLERS =================

function initExpenseReportsPage() {
  // Reset create report form
  document.getElementById("report-creation-form").reset();
  
  // Set default dates
  document.getElementById("report-start-date").valueAsDate = new Date();
  document.getElementById("report-end-date").valueAsDate = new Date();
  
  // Populate approver and verifier dropdowns
  populateReportUsersDropdowns();
  
  // Render checkable unreported expenses & draft folders
  renderUnreportedExpensesTable();
  renderDraftFoldersTable();
  
  // Close any details view
  closeReportDetails();
  
  // Default to Create tab
  switchReportTab("create-report-subtab");
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

function switchReportTab(subtabId) {
  // Toggle visibility of subtabs
  document.querySelectorAll(".report-tab-content").forEach(content => {
    content.style.display = content.id === subtabId ? "block" : "none";
  });
  
  // Toggle button styles
  const btnCreate = document.getElementById("tab-btn-create");
  const btnHistory = document.getElementById("tab-btn-history");
  
  if (subtabId === "create-report-subtab") {
    btnCreate.className = "btn btn-primary";
    btnHistory.className = "btn btn-secondary";
    renderUnreportedExpensesTable();
    renderDraftFoldersTable();
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
  
  // Managers go to Approver dropdown
  const managers = users.filter(u => u.role === "Manager" && u.status === "Active");
  managers.forEach(m => {
    approverSelect.innerHTML += `<option value="${m.name}">${m.name} (Manager)</option>`;
  });
  
  // Finance & Auditor go to Verifier dropdown
  const verifiers = users.filter(u => (u.role === "Finance" || u.role === "Auditor") && u.status === "Active");
  verifiers.forEach(v => {
    verifierSelect.innerHTML += `<option value="${v.name}">${v.name} (${v.role})</option>`;
  });
}

function renderUnreportedExpensesTable() {
  const expenses = expenseDb.getTable("expenses");
  // Filter John or David's own unreported expenses that are not linked to a report yet
  const unreported = expenses.filter(e => 
    e.employeeId === currentUser.employeeId && 
    (e.status === "UNREPORTED" || e.status === "DRAFT") && 
    (!e.reportId)
  );
  
  const container = document.getElementById("unreported-expenses-table-body");
  if (!container) return;
  container.innerHTML = "";
  
  // Uncheck select all
  const selectAll = document.getElementById("select-all-expenses");
  if (selectAll) selectAll.checked = false;
  
  if (unreported.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No unassigned expenses. Add expenses first or select them into a folder.</td></tr>`;
    return;
  }
  
  const sortedUnreported = [...unreported].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

  sortedUnreported.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="text-align: center;"><input type="checkbox" class="expense-select-chk" value="${e.id}"></td>
      <td style="font-weight: 700; color: var(--primary);">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.category}</td>
      <td>${e.description}</td>
      <td style="font-weight: 600;">${formatAmount(e.amount, e.currency)}</td>
    `;
    container.appendChild(row);
  });
}

function toggleSelectAllExpenses(masterCheckbox) {
  document.querySelectorAll(".expense-select-chk").forEach(chk => {
    chk.checked = masterCheckbox.checked;
  });
}

function handleDraftFolderCreate() {
  const title = document.getElementById("report-title").value.trim();
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;
  const approver = document.getElementById("report-approver").value;
  const verifier = document.getElementById("report-verifier").value;
  
  if (!title) {
    alert("Please enter a Report / Folder Title.");
    return;
  }
  
  if (startDate && endDate && startDate > endDate) {
    alert("End Date cannot be earlier than Start Date. Please select a valid date range.");
    return;
  }
  
  const selectedCheckboxes = document.querySelectorAll(".expense-select-chk:checked");
  const selectedIds = Array.from(selectedCheckboxes).map(chk => chk.value);
  
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const rptId = "RPT" + String(reports.length + 1).padStart(3, '0');
  
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();
  let totalSum = 0;
  selectedIds.forEach(id => {
    const exp = expenses.find(e => e.id === id);
    if (exp) {
      totalSum += convertCurrency(exp.amount, exp.currency || "IDR", userCurrency);
    }
  });

  const selectedExpenses = selectedIds.map(id => expenses.find(e => e.id === id)).filter(Boolean);
  const cleanRange = sanitizeReportDateRange(startDate, endDate, selectedExpenses);

  const newFolder = {
    id: rptId,
    title,
    startDate: cleanRange.startDate,
    endDate: cleanRange.endDate,
    approver,
    verifier,
    employeeId: currentUser.employeeId,
    employeeName: currentUser.name,
    status: "DRAFT",
    totalAmount: totalSum,
    dateCreated: new Date().toISOString().split("T")[0]
  };
  
  expenseDb.addRecord("reports", newFolder);
  
  selectedIds.forEach(id => {
    expenseDb.updateRecord("expenses", "id", id, {
      reportId: rptId
    });
  });
  
  expenseDb.addLog(
    currentUser.employeeId,
    currentUser.name,
    "Create Draft Folder",
    `Created draft expense folder ${rptId} (${title}).`
  );
  
  showToast(`Draft Folder ${rptId} created! You can attach expenses to it or submit it for approval anytime.`, "success");
  
  document.getElementById("report-creation-form").reset();
  document.getElementById("report-start-date").valueAsDate = new Date();
  document.getElementById("report-end-date").valueAsDate = new Date();
  populateReportUsersDropdowns();
  populateFormFolderDropdown();
  renderUnreportedExpensesTable();
  renderDraftFoldersTable();
}

function renderDraftFoldersTable() {
  const container = document.getElementById("draft-folders-table-body");
  if (!container) return;
  
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const userDrafts = reports.filter(r => r.employeeId === currentUser.employeeId && r.status === "DRAFT");
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();
  
  container.innerHTML = "";
  
  if (userDrafts.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No draft folders yet. Fill in the form above to create one.</td></tr>`;
    return;
  }
  
  const sortedDrafts = [...userDrafts].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));

  sortedDrafts.forEach(folder => {
    const folderExpenses = expenses.filter(e => e.reportId === folder.id);
    const cleanRange = sanitizeReportDateRange(folder.startDate, folder.endDate, folderExpenses);
    let currentTotal = 0;
    folderExpenses.forEach(e => {
      currentTotal += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
    });
    
    if (folder.totalAmount !== currentTotal || folder.startDate !== cleanRange.startDate || folder.endDate !== cleanRange.endDate) {
      expenseDb.updateRecord("reports", "id", folder.id, { 
        totalAmount: currentTotal,
        startDate: cleanRange.startDate,
        endDate: cleanRange.endDate
      });
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewReportDetails('${folder.id}')"><i class="fa-solid fa-folder"></i> ${folder.id}</td>
      <td style="font-weight: 600; cursor: pointer;" onclick="viewReportDetails('${folder.id}')">${folder.title}</td>
      <td>${formatDate(cleanRange.startDate)} - ${formatDate(cleanRange.endDate)}</td>
      <td>${folder.approver || "Not Set"}</td>
      <td style="text-align: center;"><span class="badge" style="background: rgba(79,70,229,0.1); color: var(--primary); padding: 2px 8px; border-radius: 12px; font-weight: 700;">${folderExpenses.length} items</span></td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(currentTotal, userCurrency)}</td>
      <td style="text-align: center;"><span class="status-badge draft">DRAFT</span></td>
      <td style="text-align: center;">
        <div class="action-buttons" style="justify-content: center;">
          <button class="btn btn-secondary btn-sm" onclick="viewReportDetails('${folder.id}')">Manage / View</button>
          <button class="btn btn-primary btn-sm" onclick="submitDraftFolder('${folder.id}')"><i class="fa-solid fa-paper-plane"></i> Submit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteDraftFolder('${folder.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

function submitDraftFolder(reportId) {
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const folder = reports.find(r => r.id === reportId);
  if (!folder) return;

  const expenses = expenseDb.getTable("expenses");
  const folderExpenses = expenses.filter(e => e.reportId === reportId);

  if (folderExpenses.length === 0) {
    alert("This folder is empty. Please attach at least one expense before submitting.");
    return;
  }
  
  if (!folder.approver) {
    alert("Please assign an Approver to this folder before submitting.");
    return;
  }

  // Update folder status to PENDING_MANAGER
  expenseDb.updateRecord("reports", "id", reportId, { status: "PENDING_MANAGER" });

  // Update expenses status inside folder
  folderExpenses.forEach(e => {
    expenseDb.updateRecord("expenses", "id", e.id, { status: "PENDING_MANAGER" });
  });

  expenseDb.addLog(
    currentUser.employeeId,
    currentUser.name,
    "Submit Expense Folder",
    `Submitted draft expense folder ${reportId} containing ${folderExpenses.length} claims for Manager approval.`
  );

  showToast(`Folder ${reportId} submitted successfully for Manager approval!`, "success");

  renderDraftFoldersTable();
  renderReportsHistoryTable();
  closeReportDetails();
}

function deleteDraftFolder(reportId) {
  if (confirm(`Delete draft folder ${reportId}? Contained expenses will become unassigned.`)) {
    const expenses = expenseDb.getTable("expenses");
    expenses.filter(e => e.reportId === reportId).forEach(e => {
      expenseDb.updateRecord("expenses", "id", e.id, { reportId: null });
    });
    expenseDb.deleteRecord("reports", "id", reportId);
    showToast(`Draft folder ${reportId} deleted.`, "info");
    renderDraftFoldersTable();
    renderUnreportedExpensesTable();
    populateFormFolderDropdown();
  }
}

function detachExpenseFromReport(expId, reportId) {
  expenseDb.updateRecord("expenses", "id", expId, { reportId: null, status: "UNREPORTED" });
  showToast(`Expense ${expId} removed from folder.`, "info");
  viewReportDetails(reportId);
  renderDraftFoldersTable();
  renderUnreportedExpensesTable();
}

function handleReportSubmit(event) {
  event.preventDefault();
  
  const title = document.getElementById("report-title").value.trim();
  const startDate = document.getElementById("report-start-date").value;
  const endDate = document.getElementById("report-end-date").value;
  const approver = document.getElementById("report-approver").value;
  const verifier = document.getElementById("report-verifier").value;
  
  if (startDate && endDate && startDate > endDate) {
    alert("End Date cannot be earlier than Start Date. Please select a valid date range.");
    return;
  }
  
  // Get selected checkboxes
  const selectedCheckboxes = document.querySelectorAll(".expense-select-chk:checked");
  const selectedIds = Array.from(selectedCheckboxes).map(chk => chk.value);
  
  if (selectedIds.length === 0) {
    alert("Please select at least one expense to include in this report.");
    return;
  }
  
  // Calculate total amount in home currency
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
  const selectedExpenses = selectedIds.map(id => expenses.find(e => e.id === id)).filter(Boolean);
  const cleanRange = sanitizeReportDateRange(startDate, endDate, selectedExpenses);

  const newReport = {
    id: rptId,
    title,
    startDate: cleanRange.startDate,
    endDate: cleanRange.endDate,
    approver,
    verifier,
    employeeId: currentUser.employeeId,
    employeeName: currentUser.name,
    status: "PENDING_MANAGER",
    totalAmount: totalSum,
    dateCreated: new Date().toISOString().split("T")[0]
  };
  
  expenseDb.addRecord("reports", newReport);
  
  selectedIds.forEach(id => {
    expenseDb.updateRecord("expenses", "id", id, {
      status: "PENDING_MANAGER",
      reportId: rptId
    });
  });
  
  expenseDb.addLog(
    currentUser.employeeId, 
    currentUser.name, 
    "Submit Expense Report", 
    `Submitted report ${rptId} containing ${selectedIds.length} items amounting to ${formatAmount(totalSum, userCurrency)}`
  );
  
  showToast(`Expense Report ${rptId} created and submitted for approval!`, "success");
  
  document.getElementById("report-creation-form").reset();
  document.getElementById("report-start-date").valueAsDate = new Date();
  document.getElementById("report-end-date").valueAsDate = new Date();
  populateReportUsersDropdowns();
  populateFormFolderDropdown();
  renderUnreportedExpensesTable();
  renderReportsHistoryTable();
}

function renderReportsHistoryTable() {
  const container = document.getElementById("reports-history-table-body");
  if (!container) return;
  
  let reports = expenseDb.getTable("reports");
  if (!reports) reports = [];
  const userReports = reports.filter(r => r.employeeId === currentUser.employeeId && r.status !== "DRAFT");
  const expenses = expenseDb.getTable("expenses");
  const userCurrency = getUserCurrency();
  
  container.innerHTML = "";
  
  if (userReports.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No submitted reports created yet.</td></tr>`;
    return;
  }
  
  const sorted = [...userReports].sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true, sensitivity: 'base' }));
  
  sorted.forEach(r => {
    const folderExpenses = expenses.filter(e => e.reportId === r.id);
    const cleanRange = sanitizeReportDateRange(r.startDate, r.endDate, folderExpenses);

    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewReportDetails('${r.id}')">${r.id}</td>
      <td style="font-weight: 600; cursor: pointer;" onclick="viewReportDetails('${r.id}')">${r.title}</td>
      <td>${formatDate(cleanRange.startDate)} - ${formatDate(cleanRange.endDate)}</td>
      <td>${r.approver}</td>
      <td>${r.verifier}</td>
      <td style="font-weight: 600;">${formatAmount(r.totalAmount, userCurrency)}</td>
      <td><span class="status-badge ${r.status.toLowerCase()}">${r.status.replace("_", " ")}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="viewReportDetails('${r.id}')">View</button>
      </td>
    `;
    container.appendChild(row);
  });
}

let activeEmployeeReportId = null;

function viewReportDetails(reportId) {
  activeEmployeeReportId = reportId;
  const reports = expenseDb.getTable("reports");
  const report = reports.find(r => r.id === reportId);
  if (!report) return;
  
  const userCurrency = getUserCurrency();
  const expenses = expenseDb.getTable("expenses");
  const reportExpenses = expenses.filter(e => e.reportId === report.id);
  const cleanRange = sanitizeReportDateRange(report.startDate, report.endDate, reportExpenses);
  
  document.getElementById("det-report-id").innerText = report.id;
  document.getElementById("det-report-title").innerHTML = `<i class="fa-solid fa-folder-open"></i> Folder Details: ${report.title} (${report.id})`;
  
  const statusEl = document.getElementById("det-report-status");
  statusEl.innerText = report.status.replace(/_/g, " ");
  statusEl.className = `status-badge ${report.status.toLowerCase()}`;

  document.getElementById("det-report-dates").innerText = `${formatDate(cleanRange.startDate)} to ${formatDate(cleanRange.endDate)}`;
  document.getElementById("det-report-created").innerText = formatDate(report.dateCreated);
  document.getElementById("det-report-approver").innerText = report.approver || "Not Set";
  document.getElementById("det-report-verifier").innerText = report.verifier || "Not Set";
  
  let currentTotal = 0;
  reportExpenses.forEach(e => {
    currentTotal += convertCurrency(e.amount, e.currency || "IDR", userCurrency);
  });
  document.getElementById("det-report-total").innerText = formatAmount(currentTotal, userCurrency);

  const container = document.getElementById("report-expenses-details-body");
  container.innerHTML = "";
  
  if (reportExpenses.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expenses currently attached to this folder.</td></tr>`;
  } else {
    reportExpenses.forEach(e => {
      const row = document.createElement("tr");
      const detachBtn = report.status === "DRAFT" 
        ? `<button class="btn btn-danger btn-sm" onclick="detachExpenseFromReport('${e.id}', '${report.id}')"><i class="fa-solid fa-minus-circle"></i> Remove</button>`
        : `<span style="color: var(--text-muted); font-size:11px;">Locked</span>`;

      row.innerHTML = `
        <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
        <td>${formatDate(e.date)}</td>
        <td>${e.category}</td>
        <td>${e.description}</td>
        <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
        <td style="text-align: center;">${detachBtn}</td>
      `;
      container.appendChild(row);
    });
  }

  // Handle Unassigned Expenses section & Footer actions inside modal
  const addSec = document.getElementById("folder-add-expenses-section");
  const footerActions = document.getElementById("folder-footer-actions");
  
  if (report.status === "DRAFT") {
    addSec.style.display = "block";
    renderFolderUnassignedExpenses(report.id);
    footerActions.innerHTML = `<button class="btn btn-primary" onclick="submitDraftFolder('${report.id}')"><i class="fa-solid fa-paper-plane"></i> Submit Folder for Approval</button>`;
  } else {
    addSec.style.display = "none";
    footerActions.innerHTML = "";
  }
  
  // Show modal overlay
  document.getElementById("report-details-overlay").classList.add("active");
}

function renderFolderUnassignedExpenses(reportId) {
  const container = document.getElementById("folder-unassigned-expenses-body");
  if (!container) return;
  
  const expenses = expenseDb.getTable("expenses");
  const unassigned = expenses.filter(e => e.employeeId === currentUser.employeeId && (e.status === "UNREPORTED" || e.status === "DRAFT") && !e.reportId);
  const selectAll = document.getElementById("select-all-folder-add");
  if (selectAll) selectAll.checked = false;

  container.innerHTML = "";
  if (unassigned.length === 0) {
    container.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No unassigned expenses available to attach.</td></tr>`;
    return;
  }

  unassigned.forEach(e => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td style="text-align: center;"><input type="checkbox" class="folder-add-select-chk" value="${e.id}"></td>
      <td style="font-weight: 700; color: var(--primary); cursor: pointer;" onclick="viewExpenseDetails('${e.id}')">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.category}</td>
      <td>${e.description}</td>
      <td style="font-weight: 600; text-align: right;">${formatAmount(e.amount, e.currency)}</td>
    `;
    container.appendChild(row);
  });
}

function toggleSelectAllFolderAdd(masterCheckbox) {
  document.querySelectorAll(".folder-add-select-chk").forEach(chk => {
    chk.checked = masterCheckbox.checked;
  });
}

function attachSelectedToActiveFolder() {
  if (!activeEmployeeReportId) return;
  const selectedCheckboxes = document.querySelectorAll(".folder-add-select-chk:checked");
  const selectedIds = Array.from(selectedCheckboxes).map(chk => chk.value);

  if (selectedIds.length === 0) {
    alert("Please select at least one expense to attach.");
    return;
  }

  selectedIds.forEach(id => {
    expenseDb.updateRecord("expenses", "id", id, { reportId: activeEmployeeReportId });
  });

  showToast(`Attached ${selectedIds.length} expense(s) to folder.`, "success");
  viewReportDetails(activeEmployeeReportId);
  renderDraftFoldersTable();
  renderUnreportedExpensesTable();
}

function closeReportDetails() {
  document.getElementById("report-details-overlay").classList.remove("active");
  activeEmployeeReportId = null;
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
  container.innerHTML = "";

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No matching transactions found.</td></tr>`;
    return;
  }

  // Sort descending by date
  const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(e => {
    const row = document.createElement("tr");
    const canCancel = e.status === "SUBMITTED" || e.status === "PENDING_MANAGER" || e.status === "CLARIFICATION_REQUIRED";
    
    row.innerHTML = `
      <td style="font-weight: 700; color: var(--primary);">${e.id}</td>
      <td>${formatDate(e.date)}</td>
      <td>${e.project}</td>
      <td>${e.category}</td>
      <td style="font-weight: 600;">${formatAmount(e.amount, e.currency)}</td>
      <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.remarks || "-"}</td>
      <td>
        <div class="action-buttons">
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

let charts = {};

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
  if (charts["monthly"]) charts["monthly"].destroy();
  charts["monthly"] = new Chart(ctxMonthly, {
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
          showMonthExpenses(monthIndex, selectedYear);
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
  
  // Sum of all spent categories
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

  // Sort descending by date
  const sortedRecent = [...recentExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

  const recentContainer = document.getElementById("db-recent-expenses-body");
  recentContainer.innerHTML = "";

  if (sortedRecent.length === 0) {
    recentContainer.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expenses recorded in the last 10 days.</td></tr>`;
  } else {
    sortedRecent.forEach(e => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight: 700; color: var(--primary);">${e.id}</td>
        <td>${formatDate(e.date)}</td>
        <td>${e.category}</td>
        <td>${e.project}</td>
        <td style="font-weight: 600;">${formatIDR(e.amount)}</td>
        <td><span class="status-badge ${e.status.toLowerCase()}">${e.status.replace("_", " ")}</span></td>
      `;
      recentContainer.appendChild(row);
    });
  }
}

// File Upload Integration
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
        const maxDim = 400; // max dimension 400px
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
        hiddenUrl.value = canvas.toDataURL("image/jpeg", 0.5); // Compress to 50% JPEG (extremely small!)
      };
      img.src = e.target.result;
    } else {
      hiddenUrl.value = "receipt_attached.png"; // Fallback placeholder
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

function showMonthExpenses(monthIndex, year) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[monthIndex];
  
  document.getElementById("month-expenses-title").innerText = `Expenses for ${monthName} ${year}`;
  
  const expenses = expenseDb.getTable("expenses");
  const myExpenses = expenses.filter(e => e.employeeId === currentUser.employeeId);
  const userCurrency = getUserCurrency();
  
  const filtered = myExpenses.filter(e => {
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
