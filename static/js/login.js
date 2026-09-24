// Expense ERP Login Logic (Flask Backend & MongoDB Integrated)

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorBox = document.getElementById("login-error-box");
  const submitBtn = e.target.querySelector("button[type='submit']");
  
  errorBox.style.display = "none";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
  }
  
  try {
    // Authenticate via Flask API with MongoDB
    const res = await API.login(email, password);
    
    if (res && res.success && res.user) {
      const sessionUser = res.user;
      sessionStorage.setItem("EXPENSE_SESSION", JSON.stringify(sessionUser));
      
      // Redirect to appropriate Flask route
      const role = sessionUser.role;
      if (role === "Administrator" || role === "Auditor") {
        window.location.href = "/admin";
      } else if (role === "Manager") {
        window.location.href = "/manager";
      } else if (role === "Finance") {
        window.location.href = "/finance";
      } else if (role === "Employee") {
        window.location.href = "/employee";
      } else {
        window.location.href = "/login";
      }
    } else {
      errorBox.textContent = (res && res.message) ? res.message : "Invalid email address or security password.";
      errorBox.style.display = "block";
    }
  } catch (err) {
    // Fallback validation via cached bridge
    const sessionUser = expenseDb.validateLogin(email, password);
    if (sessionUser) {
      sessionStorage.setItem("EXPENSE_SESSION", JSON.stringify(sessionUser));
      const role = sessionUser.role;
      if (role === "Administrator" || role === "Auditor") {
        window.location.href = "/admin";
      } else if (role === "Manager") {
        window.location.href = "/manager";
      } else if (role === "Finance") {
        window.location.href = "/finance";
      } else if (role === "Employee") {
        window.location.href = "/employee";
      }
    } else {
      errorBox.style.display = "block";
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Secure ERP Login';
    }
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
