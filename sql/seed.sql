-- ==========================================================
-- MS SQL Server Seed Data for Expense ERP
-- ==========================================================

-- Countries
INSERT INTO Countries (code, name, currency, status) VALUES 
('ID', 'Indonesia', 'IDR', 'Active'),
('IN', 'India', 'INR', 'Active'),
('US', 'United States', 'USD', 'Active'),
('DE', 'Germany', 'EUR', 'Active');

-- Projects
INSERT INTO Projects (code, name, country, manager, startDate, endDate, status) VALUES 
('PRJ-JAK', 'Jakarta Project', 'ID', 'Sarah', '2026-01-01', '2026-12-31', 'Active'),
('PRJ-MUM', 'Mumbai Tech', 'IN', 'Sarah', '2026-01-01', '2026-12-31', 'Active'),
('PRJ-DEL', 'Delhi Project', 'IN', 'Sarah', '2026-01-01', '2026-12-31', 'Active'),
('PRJ-USA', 'US HQ Expansion', 'US', 'Nikita', '2026-03-01', '2027-03-01', 'Active'),
('PRJ-MUN', 'Munich Lab', 'DE', 'Nikita', '2026-05-01', '2026-11-30', 'Active');

-- Departments
INSERT INTO Departments (code, name, manager, status) VALUES 
('IT', 'Information Technology', 'Nikita', 'Active'),
('FIN', 'Finance & Accounts', 'Finance User', 'Active'),
('HR', 'Human Resources', 'HR Manager', 'Active'),
('SAL', 'Sales & Marketing', 'Nikita', 'Active'),
('OPS', 'Operations', 'Ops Manager', 'Active');

-- Employees
INSERT INTO Employees (id, name, email, country, project, department, manager, designation, grade, costCenter, bankDetails, status) VALUES 
('EMP001', 'John', 'john@expense.com', 'ID', 'PRJ-JAK', 'IT', 'Sarah', 'Software Engineer', 'Staff', 'CC001', 'BCA 1234567890', 'Active'),
('EMP002', 'David', 'david@expense.com', 'ID', 'PRJ-JAK', 'IT', 'Sarah', 'UX Designer', 'Staff', 'CC001', 'Mandiri 0987654321', 'Active'),
('EMP003', 'Sarah', 'sarah@expense.com', 'ID', 'PRJ-JAK', 'IT', 'Nikita', 'Engineering Manager', 'Manager', 'CC001', 'BCA 9998887776', 'Active'),
('EMP004', 'Nikita', 'nikita@expense.com', 'US', 'PRJ-USA', 'IT', 'CEO', 'Director of IT', 'Director', 'CC001', 'Chase 55544433322', 'Active'),
('EMP005', 'Finance User', 'finance@expense.com', 'ID', 'PRJ-JAK', 'FIN', 'Nikita', 'Finance Manager', 'Senior Staff', 'CC002', 'BCA 1112223334', 'Active'),
('EMP006', 'Auditor User', 'auditor@expense.com', 'US', 'PRJ-USA', 'FIN', 'Nikita', 'External Auditor', 'Senior Manager', 'CC002', 'Citibank 7776665554', 'Active');

-- Users
INSERT INTO Users (id, employeeId, name, email, role, password, status) VALUES 
('USR001', 'EMP001', 'John', 'john@expense.com', 'Employee', 'employee123', 'Active'),
('USR002', 'EMP002', 'David', 'david@expense.com', 'Employee', 'employee123', 'Active'),
('USR003', 'EMP003', 'Sarah', 'sarah@expense.com', 'Manager', 'manager123', 'Active'),
('USR004', 'EMP004', 'Nikita', 'nikita@expense.com', 'Administrator', 'admin123', 'Active'),
('USR005', 'EMP005', 'Finance User', 'finance@expense.com', 'Finance', 'finance123', 'Active'),
('USR006', 'EMP006', 'Auditor User', 'auditor@expense.com', 'Auditor', 'auditor123', 'Active');

-- Roles
INSERT INTO Roles (name, [desc], status) VALUES 
('Administrator', 'Full system configuration and master data control', 'Active'),
('Manager', 'Team expense review, approval, and clarification', 'Active'),
('Finance', 'Finance verification, payment processing, and disbursements', 'Active'),
('Employee', 'Submit, track, and edit own expenses and drafts', 'Active'),
('Auditor', 'Read-only access to all transactions, reports, and logs', 'Active');

-- Permissions
INSERT INTO Permissions (role, userSetup, addExpense, approveExpense, financeVerify, reports, systemSetup) VALUES 
('Administrator', 1, 1, 1, 1, '1', 1),
('Manager', 0, 1, 1, 0, '1', 0),
('Finance', 0, 1, 0, 1, '1', 0),
('Employee', 0, 1, 0, 0, 'Own', 0),
('Auditor', 0, 0, 0, 0, '1', 0);

-- Expense Categories
INSERT INTO ExpenseCategories (code, name, icon, status) VALUES 
('TRA', 'Travel', 'plane', 'Active'),
('ACC', 'Accommodation', 'hotel', 'Active'),
('FOO', 'Food', 'utensils', 'Active'),
('OFF', 'Office', 'desktop', 'Active');

-- Expense Types
INSERT INTO ExpenseTypes (code, category, name, limit, currency, status) VALUES 
('FLI', 'TRA', 'Flight', 5000000, 'IDR', 'Active'),
('TRN', 'TRA', 'Train', 1000000, 'IDR', 'Active'),
('TXI', 'TRA', 'Taxi', 500000, 'IDR', 'Active'),
('CAR', 'TRA', 'Car Rental', 1500000, 'IDR', 'Active'),
('HTL', 'ACC', 'Hotel', 1500000, 'IDR', 'Active'),
('GST', 'ACC', 'Guest House', 800000, 'IDR', 'Active'),
('LNC', 'FOO', 'Lunch', 150000, 'IDR', 'Active'),
('DIN', 'FOO', 'Dinner', 200000, 'IDR', 'Active'),
('CLM', 'FOO', 'Client Meal', 500000, 'IDR', 'Active'),
('STN', 'OFF', 'Stationery', 300000, 'IDR', 'Active'),
('EQP', 'OFF', 'Equipment', 5000000, 'IDR', 'Active'),
('PRN', 'OFF', 'Printing', 200000, 'IDR', 'Active');

-- Currencies
INSERT INTO Currencies (code, name, symbol, decimalPlaces, status) VALUES 
('IDR', 'Indonesian Rupiah', 'Rp', 0, 'Active'),
('INR', 'Indian Rupee', '₹', 2, 'Active'),
('USD', 'US Dollar', '$', 2, 'Active'),
('EUR', 'Euro', '€', 2, 'Active');

-- Payment Methods
INSERT INTO PaymentMethods (code, name, status) VALUES 
('CSH', 'Cash', 'Active'),
('PCC', 'Personal Credit Card', 'Active'),
('PDC', 'Personal Debit Card', 'Active'),
('CCC', 'Company Credit Card', 'Active'),
('BTF', 'Bank Transfer', 'Active'),
('CAD', 'Company Advance', 'Active');

-- Approval Workflows
INSERT INTO ApprovalWorkflows (code, name, description, status) VALUES 
('STD', 'Standard Expense Workflow', 'Submit -> Manager Approval -> Finance Verification -> Finance Payout', 'Active');

-- Approvers
INSERT INTO Approvers (project, department, level, approver) VALUES 
('PRJ-JAK', 'IT', 1, 'Sarah'),
('PRJ-JAK', 'IT', 2, 'Finance User'),
('PRJ-DEL', 'Sales', 1, 'Sarah');

-- Expense Policies
INSERT INTO ExpensePolicies (id, type, limit, currency, scope, action) VALUES 
('POL001', 'Hotel', 1500000, 'IDR', 'Global', 'Warning'),
('POL002', 'Food', 300000, 'IDR', 'Daily', 'Warning'),
('POL003', 'Taxi', 500000, 'IDR', 'Per Trip', 'Block'),
('POL004', 'Flight', 5000000, 'IDR', 'Per Trip', 'Warning');

-- Employee Grades
INSERT INTO EmployeeGrades (name, description) VALUES 
('Staff', 'Junior and mid-level contributors'),
('Senior Staff', 'Senior engineers and specialist roles'),
('Manager', 'Team leads and department managers'),
('Senior Manager', 'Directors and function heads'),
('Director', 'Executive leadership');

-- Cost Centers
INSERT INTO CostCenters (code, name, status) VALUES 
('CC001', 'CC001 - IT', 'Active'),
('CC002', 'CC002 - Finance', 'Active'),
('CC003', 'CC003 - HR', 'Active'),
('CC004', 'CC004 - Operations', 'Active');

-- Locations
INSERT INTO Locations (code, name, country, status) VALUES 
('JAK', 'Jakarta', 'ID', 'Active'),
('MUM', 'Mumbai', 'IN', 'Active'),
('DEL', 'Delhi', 'IN', 'Active'),
('NYC', 'New York', 'US', 'Active'),
('MUN', 'Munich', 'DE', 'Active');

-- Tax Masters
INSERT INTO TaxMasters (code, name, rate, country, status) VALUES 
('VAT11', 'VAT 11%', 11.0, 'ID', 'Active'),
('GST18', 'GST 18%', 18.0, 'IN', 'Active'),
('SALES8', 'Sales Tax 8.875%', 8.875, 'US', 'Active');

-- Document Types
INSERT INTO DocumentTypes (name, status) VALUES 
('Invoice', 'Active'),
('Receipt', 'Active'),
('Hotel Bill', 'Active'),
('Flight Ticket', 'Active'),
('Taxi Receipt', 'Active'),
('Credit Card Statement', 'Active'),
('Other', 'Active');

-- Expenses
INSERT INTO Expenses (id, date, employeeId, employeeName, country, project, department, category, type, amount, currency, paymentMethod, description, receiptUrl, status, reportId, remarks, dateCreated) VALUES 
('EXP001', '2026-08-20', 'EMP001', 'John', 'ID', 'PRJ-JAK', 'IT', 'Travel', 'Flight', 15000000, 'IDR', 'Company Credit Card', 'Flight ticket for Jakarta Client Onboarding', 'receipt_flight.jpg', 'PENDING_MANAGER', 'RPT001', '', '2026-08-20'),
('EXP002', '2026-08-22', 'EMP001', 'John', 'ID', 'PRJ-JAK', 'IT', 'Travel', 'Taxi', 3500000, 'IDR', 'Cash', 'Airport Limousine & Local Taxi Transfers', 'receipt_taxi.jpg', 'PENDING_MANAGER', 'RPT001', '', '2026-08-22'),
('EXP003', '2026-08-15', 'EMP002', 'David', 'ID', 'PRJ-JAK', 'IT', 'Hotel', 'Hotel', 8500000, 'IDR', 'Personal Credit Card', 'Hotel Accommodation (5 nights)', 'receipt_hotel.jpg', 'PENDING_FINANCE', 'RPT002', 'Approved by manager Sarah', '2026-08-15'),
('EXP004', '2026-08-18', 'EMP002', 'David', 'ID', 'PRJ-JAK', 'IT', 'Office', 'Stationery', 5000000, 'IDR', 'Bank Transfer', 'Bulk Site Office Supplies', 'receipt_stationery.png', 'PENDING_FINANCE', 'RPT002', 'Approved by manager Sarah', '2026-08-18'),
('EXP005', '2026-08-26', 'EMP001', 'John', 'ID', 'PRJ-JAK', 'IT', 'Food', 'Client Meal', 4300000, 'IDR', 'Cash', 'Dinner with Client Stakeholders', 'receipt_dinner.jpg', 'DRAFT', 'RPT003', '', '2026-08-26');

-- Reports
INSERT INTO Reports (id, title, startDate, endDate, approver, verifier, employeeId, employeeName, status, totalAmount, dateCreated) VALUES 
('RPT001', 'Q3 Business Travel & Client Onboarding', '2026-08-20', '2026-08-22', 'Sarah', 'Finance User', 'EMP001', 'John', 'PENDING_MANAGER', 18500000, '2026-08-22'),
('RPT002', 'Jakarta Site Inspection & Supplies', '2026-08-15', '2026-08-18', 'Sarah', 'Finance User', 'EMP002', 'David', 'PENDING_FINANCE', 13500000, '2026-08-18'),
('RPT003', 'Draft Client Dinner & Catering', '2026-08-26', '2026-08-26', 'Sarah', 'Finance User', 'EMP001', 'John', 'DRAFT', 4300000, '2026-08-26');

-- Reasons
INSERT INTO Reasons (code, name, type) VALUES 
('MREC', 'Missing Receipt', 'Clarification'),
('INVD', 'Invalid Date', 'Clarification'),
('EXCL', 'Exceeds Category Limit', 'Clarification'),
('DUPC', 'Duplicate Claim', 'Rejection'),
('UNPL', 'Unapproved Policy Violation', 'Rejection'),
('OTHR', 'Other Reason', 'Both');

-- Expense Statuses
INSERT INTO ExpenseStatuses (code, label) VALUES 
('DRAFT', 'Draft'),
('UNREPORTED', 'Unreported Pool'),
('PENDING_MANAGER', 'Pending Manager Approval'),
('PENDING_FINANCE', 'Pending Finance Verification'),
('FINANCE_APPROVED', 'Finance Verified'),
('PAID', 'Paid / Reimbursed'),
('MANAGER_REJECTED', 'Rejected by Manager'),
('FINANCE_REJECTED', 'Rejected by Finance'),
('CLARIFICATION_REQUIRED', 'Clarification Required'),
('CANCELLED', 'Cancelled'),
('SETTLED', 'Settled');

-- Settlements Seed Data
INSERT INTO Settlements (id, employeeId, employeeName, type, mode, amount, currency, balanceBefore, balanceAfter, notes, settledBy, dateCreated) VALUES 
('SETTLE-001', 'EMP001', 'John', 'Dr', 'Out of system (Bank Transfer)', 150000.00, 'IDR', 400000.00, 250000.00, 'Batch reimbursement for Taxi travel claim', 'Finance User', '2026-08-25 14:30:00'),
('SETTLE-002', 'EMP002', 'David', 'Dr', 'Company Bank Transfer', 350000.00, 'IDR', 350000.00, 0.00, 'Full clearance for client dinner expense', 'Finance User', '2026-08-28 11:15:00');

-- System & Client License Configuration Seed Data
INSERT INTO SystemConfig ([key], [value], [description], [updatedAt]) VALUES 
('MAX_USER_LICENSE', '50', 'Maximum allowed active user / employee client licenses', '2026-09-08 20:00:00'),
('CLIENT_NAME', 'Enterprise Commercial Client', 'Licensed Client Organization Name', '2026-09-08 20:00:00'),
('LICENSE_KEY', 'EXP-2026-ENT-50U-COMMERCIAL', 'Product Commercial License Key', '2026-09-08 20:00:00'),
('LICENSE_TIER', 'Professional Edition (50 Seats)', 'Subscription License Tier', '2026-09-08 20:00:00'),
('LICENSE_EXPIRY', '2027-12-31', 'License Expiration Date', '2026-09-08 20:00:00');

