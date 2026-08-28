// Expense ERP Login Logic

document.getElementById("login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorBox = document.getElementById("login-error-box");
  
  errorBox.style.display = "none";
  
  // Call DB authenticator
  const sessionUser = expenseDb.validateLogin(email, password);
  
  if (sessionUser) {
    // Write credentials to sessionStorage
    sessionStorage.setItem("EXPENSE_SESSION", JSON.stringify(sessionUser));
    
    // Log audit trail
    expenseDb.addLog(sessionUser.employeeId, sessionUser.name, "Login Successful", `User ${sessionUser.name} authenticated.`);
    
    // Redirect based on role
    const role = sessionUser.role;
    if (role === "Administrator" || role === "Auditor") {
      window.location.href = "admin.html";
    } else if (role === "Manager") {
      window.location.href = "manager.html";
    } else if (role === "Finance") {
      window.location.href = "finance.html";
    } else if (role === "Employee") {
      window.location.href = "employee.html";
    }
  } else {
    errorBox.style.display = "block";
  }
});

// Autofill helper for easy login - auto submits!
function autofill(email, password) {
  document.getElementById("login-email").value = email;
  document.getElementById("login-password").value = password;
  document.getElementById("login-error-box").style.display = "none";
  
  // Trigger form submit directly
  const submitEvent = new Event("submit", { cancelable: true });
  document.getElementById("login-form").dispatchEvent(submitEvent);
}
