# NexCampus — Enterprise Master Setup & Operational Run Guide

**NexCampus** is a full-stack, enterprise-grade smart campus management web application built for scalable, secure, and persistent campus administration.

---

## 1. System Architecture Overview

```
                   ┌────────────────────────────────────────┐
                   │    Frontend: React 18 + Vite (5173)    │
                   │  Tailwind CSS · Lucide · React Router  │
                   └───────────────────┬────────────────────┘
                                       │ /api (Vite Proxy)
                                       ▼
                   ┌────────────────────────────────────────┐
                   │     Backend: Node.js + Express (5000)  │
                   │  JWT Auth · RBAC · Audit · Razorpay    │
                   └───────────────────┬────────────────────┘
                                       │ pg Pool (SSL)
                                       ▼
                   ┌────────────────────────────────────────┐
                   │   Database: Supabase PostgreSQL (6543) │
                   │  36 Tables · Foreign Keys · Audit Logs │
                   └────────────────────────────────────────┘
```

---

## 2. Prerequisites
- **Node.js**: v18.x, v20.x, or v24.x (verified on Node v24.9.0)
- **Database**: Supabase PostgreSQL (recommended) or any PostgreSQL 13+ instance.
- **Payment Gateway (Optional for testing)**: Razorpay Test Key ID and Secret.

---

## 3. Environment Variables Configuration

Create or update `backend/.env` with your real connection strings:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Database Connection (Supabase Pooled or Direct URI)
DATABASE_URL=postgres://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
DB_SSL=true

# Authentication Secrets
JWT_SECRET=nexcampus_jwt_super_secret_production_key_2026_!
JWT_EXPIRES_IN=7d

# Payment Gateway (Razorpay Test Keys)
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourRazorpaySecretHere
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

# Storage (Supabase)
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=YourServiceRoleKeyHere
```

---

## 4. Database Setup: Migrations & Seeding

NexCampus utilizes SQL migrations with transaction safety and idempotent seeding:

```powershell
# 1. Apply Schema Migrations (001_initial_schema + 002_leave_approvals)
cd backend
npm run migrate

# 2. Seed Initial Roles, Permissions, Categories, and Default Super Admin
npm run seed

# 3. Test Database Connection
npm run db:test
```

### Default System Accounts Seeded:
- **Super Administrator**:
  - Email: `superadmin@nexcampus.edu`
  - Password: `Admin@NexCampus2026!`
- **Roles Seeded**: `super_admin`, `delegated_admin`, `faculty`, `student`, `security_guard`, `hostel_warden`, `mess_staff`, `maintenance_staff`

---

## 5. Running the Application

### Method A: Single Command from Project Root
```powershell
# From the root directory (d:\hackathon project)
npm run dev
```
*(Runs both backend on `http://localhost:5000` and frontend on `http://localhost:5173` concurrently)*

### Method B: Separate Terminals
```powershell
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## 6. Running the Automated Test Suite

All 25 unit and operational logic tests can be run via:
```powershell
cd backend
npm test
```

### Coverage includes:
1. **Auth Engine**: Password hashing with bcrypt, JWT claims signing/decoding, RBAC permission gates.
2. **Academic Operations**: Timetable collision detection, 75% attendance threshold calculation, leave validation.
3. **Administration & CMO**: Account status transitions, CMO appointment rules, staff category duty mapping.
4. **Security Module**: Gate pass state machine transitions, cryptographic QR token verification (`NC-PASS-uuid`), duplicate movement prevention, overdue watchlist calculation.

---

## 7. Master Module Walkthrough

### 🏛 1. Super Admin & Delegated Administration
- **Appoint Administrators** (`/admin/administrators`): Create scoped delegated admins (Academic, Accounts, Hostel, Security).
- **Designate Complaint Management Officer (CMO)** (`/admin/cmo-appointment`): Strictly reserved for Super Admin to appoint/revoke CMO authority.
- **Staff Lifecycle** (`/admin/staff`): Register guards, wardens, and maintenance staff.
- **Audit Logs** (`/admin/audit-logs`): Real-time immutable record of all security-sensitive actions.

### 📚 2. Academic Operations
- **Mark Attendance** (`/academic/attendance`): Faculty records and modifies attendance.
- **Timetable Scheduler** (`/academic/timetables`): Conflict-free weekly schedules with room and faculty collision detection.
- **Leave Management** (`/academic/leaves`): Review student leaves with mandatory rejection reason requirements.

### 🛡️ 3. Physical Security & Gate Movement
- **Student Digital Gate-Pass** (`/student/gatepass`): Request passes and obtain cryptographic QR codes (`NC-PASS-*`).
- **Gate Approvals** (`/academic/gatepasses`): Wardens/faculty approve or reject passes.
- **QR Gate Scanner** (`/security/scanner`): Guard camera or token entry with instant visual feedback and checkout/check-in logging.
- **Gate Movement Logs** (`/security/movements`): Full chronological activity tracking.
- **Overdue Watchlist** (`/security/overdue`): Real-time monitor of students who have exceeded approved return times.

### 💳 4. Fees & Razorpay Payment Gateway
- **Fee Management** (`/admin/fees`): Define categories, yearly fee structures, and generate student invoices.
- **Student Payment Desk** (`/student/fees`): Pay fees online with Razorpay checkout, receive instant verified receipts.
- **HMAC Verification**: Server-side cryptographic signature check (`/api/fees/payment/verify`) and webhook processing (`/api/fees/webhooks/razorpay`).

### ⚠️ 5. Centralized Complaint Management (CMO)
- **Student Submission** (`/student/complaints`): Report hostel, mess, academic, or maintenance issues with priority levels.
- **CMO Operations Desk** (`/cmo/dashboard`): Triage complaints, assign to staff, record resolution progress, escalate to Super Admin, or reopen incomplete resolutions.

### 📢 6. Communications, Vault & Student Portfolio
- **Campus Notice Board** (`/notices`): Publish pinned and priority announcements with auto-expiry.
- **Notification Center** (`/notifications`): Real-time notification feed with read/unread tracking and bell counter.
- **Documents & Vault** (`/documents`): Public and department document repository with Supabase storage links.
- **Student Portfolio** (`/student/portfolio`): Comprehensive academic snapshot (attendance progress bar, fee dues, gate passes, complaints, and editable emergency contact profile).

---

## 8. Persistence Verification Guarantee

NexCampus is architected to guarantee zero data loss:
1. Register a student at `http://localhost:5173/register`.
2. Generate an invoice from Admin (`/admin/fees`) and request a gate-pass (`/student/gatepass`).
3. Terminate both backend and frontend Node.js processes.
4. Restart your machine or restart the servers.
5. Log back in: all profiles, passwords, invoices, tokens, and records will be immediately retrieved from Supabase PostgreSQL.
