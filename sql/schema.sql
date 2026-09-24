-- ==========================================================
-- MS SQL Server Database Schema for Expense ERP
-- Database: ExpenseDB
-- ==========================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Countries')
BEGIN
    CREATE TABLE Countries (
        code NVARCHAR(10) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        currency NVARCHAR(10) NOT NULL,
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Projects')
BEGIN
    CREATE TABLE Projects (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        country NVARCHAR(10),
        manager NVARCHAR(100),
        startDate NVARCHAR(20),
        endDate NVARCHAR(20),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Departments')
BEGIN
    CREATE TABLE Departments (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        manager NVARCHAR(100),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employees')
BEGIN
    CREATE TABLE Employees (
        id NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        email NVARCHAR(150) NOT NULL,
        country NVARCHAR(10),
        project NVARCHAR(50),
        department NVARCHAR(50),
        manager NVARCHAR(100),
        designation NVARCHAR(100),
        grade NVARCHAR(50),
        costCenter NVARCHAR(50),
        bankDetails NVARCHAR(255),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        id NVARCHAR(20) PRIMARY KEY,
        employeeId NVARCHAR(20),
        name NVARCHAR(150) NOT NULL,
        email NVARCHAR(150) NOT NULL UNIQUE,
        role NVARCHAR(50) NOT NULL,
        password NVARCHAR(255) NOT NULL,
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
BEGIN
    CREATE TABLE Roles (
        name NVARCHAR(50) PRIMARY KEY,
        [desc] NVARCHAR(255),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Permissions')
BEGIN
    CREATE TABLE Permissions (
        role NVARCHAR(50) PRIMARY KEY,
        userSetup BIT DEFAULT 0,
        addExpense BIT DEFAULT 0,
        approveExpense BIT DEFAULT 0,
        financeVerify BIT DEFAULT 0,
        reports NVARCHAR(20) DEFAULT '0',
        systemSetup BIT DEFAULT 0
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExpenseCategories')
BEGIN
    CREATE TABLE ExpenseCategories (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        icon NVARCHAR(50) DEFAULT 'receipt',
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExpenseTypes')
BEGIN
    CREATE TABLE ExpenseTypes (
        code NVARCHAR(20) PRIMARY KEY,
        category NVARCHAR(20),
        name NVARCHAR(100) NOT NULL,
        limit DECIMAL(18, 2) DEFAULT 0,
        currency NVARCHAR(10) DEFAULT 'IDR',
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Currencies')
BEGIN
    CREATE TABLE Currencies (
        code NVARCHAR(10) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        symbol NVARCHAR(10) NOT NULL,
        decimalPlaces INT DEFAULT 2,
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentMethods')
BEGIN
    CREATE TABLE PaymentMethods (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApprovalWorkflows')
BEGIN
    CREATE TABLE ApprovalWorkflows (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(255),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Approvers')
BEGIN
    CREATE TABLE Approvers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        project NVARCHAR(50),
        department NVARCHAR(50),
        level INT DEFAULT 1,
        approver NVARCHAR(100) NOT NULL
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExpensePolicies')
BEGIN
    CREATE TABLE ExpensePolicies (
        id NVARCHAR(20) PRIMARY KEY,
        type NVARCHAR(100) NOT NULL,
        limit DECIMAL(18, 2) DEFAULT 0,
        currency NVARCHAR(10) DEFAULT 'IDR',
        scope NVARCHAR(50) DEFAULT 'Global',
        action NVARCHAR(50) DEFAULT 'Warning'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EmployeeGrades')
BEGIN
    CREATE TABLE EmployeeGrades (
        name NVARCHAR(50) PRIMARY KEY,
        description NVARCHAR(255)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CostCenters')
BEGIN
    CREATE TABLE CostCenters (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Locations')
BEGIN
    CREATE TABLE Locations (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        country NVARCHAR(10),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TaxMasters')
BEGIN
    CREATE TABLE TaxMasters (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        rate DECIMAL(5, 3) DEFAULT 0,
        country NVARCHAR(10),
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DocumentTypes')
BEGIN
    CREATE TABLE DocumentTypes (
        name NVARCHAR(100) PRIMARY KEY,
        status NVARCHAR(20) DEFAULT 'Active'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Expenses')
BEGIN
    CREATE TABLE Expenses (
        id NVARCHAR(50) PRIMARY KEY,
        date NVARCHAR(20) NOT NULL,
        employeeId NVARCHAR(20) NOT NULL,
        employeeName NVARCHAR(150),
        country NVARCHAR(10),
        project NVARCHAR(50),
        department NVARCHAR(50),
        category NVARCHAR(100),
        type NVARCHAR(100),
        amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
        currency NVARCHAR(10) DEFAULT 'IDR',
        paymentMethod NVARCHAR(100),
        description NVARCHAR(MAX),
        receiptUrl NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'UNREPORTED',
        reportId NVARCHAR(50),
        remarks NVARCHAR(MAX),
        dateCreated NVARCHAR(30)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Reports')
BEGIN
    CREATE TABLE Reports (
        id NVARCHAR(50) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        startDate NVARCHAR(20),
        endDate NVARCHAR(20),
        approver NVARCHAR(100),
        verifier NVARCHAR(100),
        employeeId NVARCHAR(20) NOT NULL,
        employeeName NVARCHAR(150),
        status NVARCHAR(50) DEFAULT 'DRAFT',
        totalAmount DECIMAL(18, 2) DEFAULT 0,
        dateCreated NVARCHAR(30)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Reimbursements')
BEGIN
    CREATE TABLE Reimbursements (
        id NVARCHAR(50) PRIMARY KEY,
        reportId NVARCHAR(50),
        employeeId NVARCHAR(20),
        amount DECIMAL(18, 2) DEFAULT 0,
        currency NVARCHAR(10) DEFAULT 'IDR',
        paidDate NVARCHAR(20),
        paymentMethod NVARCHAR(100),
        referenceNo NVARCHAR(100),
        remarks NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'PAID'
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Reasons')
BEGIN
    CREATE TABLE Reasons (
        code NVARCHAR(20) PRIMARY KEY,
        name NVARCHAR(150) NOT NULL,
        type NVARCHAR(50)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExpenseStatuses')
BEGIN
    CREATE TABLE ExpenseStatuses (
        code NVARCHAR(50) PRIMARY KEY,
        label NVARCHAR(100) NOT NULL
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs')
BEGIN
    CREATE TABLE AuditLogs (
        id NVARCHAR(50) PRIMARY KEY,
        timestamp NVARCHAR(30) NOT NULL,
        userId NVARCHAR(50),
        userName NVARCHAR(150),
        action NVARCHAR(100),
        details NVARCHAR(MAX)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Settlements')
BEGIN
    CREATE TABLE Settlements (
        id NVARCHAR(50) PRIMARY KEY,
        employeeId NVARCHAR(20) NOT NULL,
        employeeName NVARCHAR(150),
        type NVARCHAR(20) NOT NULL,
        mode NVARCHAR(100) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL DEFAULT 0,
        currency NVARCHAR(10) DEFAULT 'INR',
        balanceBefore DECIMAL(18, 2) DEFAULT 0,
        balanceAfter DECIMAL(18, 2) DEFAULT 0,
        notes NVARCHAR(MAX),
        settledBy NVARCHAR(150),
        dateCreated NVARCHAR(30)
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemConfig')
BEGIN
    CREATE TABLE SystemConfig (
        [key] NVARCHAR(50) PRIMARY KEY,
        [value] NVARCHAR(MAX) NOT NULL,
        [description] NVARCHAR(255),
        [updatedAt] NVARCHAR(50)
    );
END;

