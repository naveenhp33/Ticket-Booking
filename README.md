# VDesk — Premium IT Support Hub (v1.2)

## Project Info
- **Project:** VDesk — IT Support & Asset Management System
- **Client:** VDart (Internal)
- **Stack:** MERN (MongoDB, Express.js, React.js, Node.js)
- **Version:** 1.2
- **Last Updated:** June 2025

---

## 📋 Changelog — v1.2 (Today's Session)

### 🔐 Authentication Overhaul
- **Passwordless OTP Login** — Replaced password-based login with a two-step email OTP flow for all employees. Employees enter their `@vdartinc.com` email, receive a 6-digit code via Gmail, and paste it to gain access.
- **Admin Dev Backdoor** — For development testing, `admin@vdartinc.com` receives the OTP directly in the API response (`devCode`). A yellow banner on the login page auto-fills the code. Clearly marked for removal before production.
- **Removed Registration Flow** — `/register` and `/verify-email` routes removed. All users are now onboarded exclusively by Admin.
- **OTP Expiry** — Reduced to 5 minutes. Invalidated immediately after first use.
- **Unknown Email Rejection** — Emails not found in the database return `"No active account found. Please contact your Admin."` — no OTP is generated.

### 👤 Admin User Management
- **No-Email Onboarding** — When Admin creates a user (single or bulk CSV), no credentials email is sent to the employee. Password is stored securely (bcrypt) in the database only.
- **Password Reveal Panel** — After creating a user, the generated password is shown once on the Admin's screen with a Copy to Clipboard button. It is never retrievable again from the UI.
- **Auto-Generate Password** — Admin can click "Generate" to auto-create a secure 12-character password, or type their own.
- **Bulk CSV Import** — Supports extended CSV format with fields: `name`, `email`, `role`, `id`, `department`, `team`, `shift`, `designation`, `experience`. Uses MongoDB `bulkWrite` with upsert — existing users are updated, new users are inserted.
- **Bulk Delete** — Multi-select checkboxes on the user table with a floating action bar. Confirmation modal before deletion. Backend safety check prevents Admin from deleting their own account.
- **Server-Side Pagination** — User table loads 20 users per page with real prev/next controls and `X–Y of Z` counter.
- **CSV Template Download** — Downloads a pre-filled template with all supported columns using a data URI (no Blob/URL issues on Windows).

### 📊 Analytics & Reports Pages
- **`/analytics`** — New page showing: total tickets KPI cards, status breakdown bars, priority breakdown bars, category distribution table. Data from `GET /api/dashboard/analytics`.
- **`/reports`** — New page showing: avg resolution time, SLA compliance rate, top 5 issue categories, agent performance table with star ratings. Data from `GET /api/dashboard/reports`.
- **Backend Aggregations** — Both endpoints use MongoDB `$group` aggregations for efficiency at scale.

### 🗂️ Table UI Overhaul
- **Enterprise Table CSS** — New `.ent-table` / `.ent-table-wrap` CSS classes applied to both the Users table and Tickets table.
- `table-layout: fixed`, `border-collapse: collapse`, `width: 100%`
- `thead` background `#1F4E79` with white bold uppercase text
- 15px cell padding, `text-overflow: ellipsis` on all cells
- `.col-center` / `.col-right` / `.col-check` alignment helpers
- Row hover `#f0f5fb`, `border-bottom: 1px solid #e0e0e0`
- Checkboxes perfectly centered via `display: block; margin: 0 auto`

### 🧭 Sidebar & Navigation
- **Font Awesome Icons** — Admin sidebar nav items now use FA icons: `fa-chart-bar` (Reports), `fa-chart-line` (Analytics), `fa-gauge` (Dashboard), `fa-users` (Users).
- **Active State** — Active nav link highlighted with `background: #1F4E79` and white text.
- **Logout UX** — Logout button uses `fa-right-from-bracket` FA icon with a "Logging out..." spinner (800ms delay). Clears localStorage, API headers, React state, and redirects to `/login`.

### 🎫 Ticket Creation Form
- **Location Field** — New hybrid dropdown between Issue Type and Priority with options: Main Office, Development Floor, HR Wing, Server Room, Hybrid, Other.
- **Custom Dropdown** — Built with `<div>` elements (not native `<select>`) to support Font Awesome icons in each option.
- **Conditional Input** — Selecting "Hybrid" or "Other" reveals a text input for a specific location (e.g., "Desk 402").
- **Validation** — Location is required. If "Other" is selected, the text field is also required.

### 🛠️ Bug Fixes
- Fixed `email.service.js` — `sendVerificationEmail` and `sendTicketConfirmation` were missing `const` declarations, breaking the entire email module.
- Fixed SMTP transporter — was reading `SMTP_PASSWORD` instead of `SMTP_PASS` from `.env`.
- Replaced broken Gmail OAuth2 transporter with direct SMTP App Password connection.
- Disabled email poller in `server.js` to stop repeated `disabled_client` errors from expired IMAP credentials.
- Fixed white page on Login — file had mixed-up code from old password login merged with OTP flow.
- Fixed CSV download — replaced `Blob/createObjectURL` with `data:text/csv` URI to prevent Windows File Explorer from hanging.

---

## User Roles

### Employee
- [x] Login using @vdartinc.com email only (OTP-based, passwordless)
- [x] Raise IT support ticket (Portal or Email)
- [x] Confirm Agent Arrival for on-site visits
- [x] Verify Resolution ("Handshake") before ticket closure
- [x] View real-time "Request Journey" progress
- [x] Receive automated status/SLA notifications

### Support Agent
- [x] Real-time dashboard for assigned tickets
- [x] Update live status (Available / On-Site / Remote / Away)
- [x] Log on-site arrival (Requires employee verification)
- [x] Propose resolutions and submit internal notes

### Admin
- [x] Centralized governance and resource allocation
- [x] View systemic analytics and department-wise workloads
- [x] Global filter for status, priority, and department
- [x] Manage User Expertise and Load-Balancing rules
- [x] Bulk import employees via CSV
- [x] Bulk delete users with confirmation
- [x] View Analytics and Reports dashboards

---

## Pages Build Status

### Frontend (React.js)
- [x] Login Page (OTP-based, two-step)
- [x] Employee Dashboard
- [x] Ticket Creation Form (with Location field)
- [x] Ticket Tracking Page
- [x] Admin Dashboard
- [x] Admin User Management (with bulk import/delete, pagination)
- [x] Admin Analytics Page
- [x] Admin Reports Page

### Backend APIs (Node.js + Express.js)
- [x] POST /api/auth/send-otp
- [x] POST /api/auth/verify-otp
- [x] POST /api/auth/admin/create-user
- [x] PUT /api/auth/admin/reset-password
- [x] POST /api/tickets/create
- [x] GET /api/tickets
- [x] PATCH /api/tickets/:id/status
- [x] POST /api/users/bulk-import
- [x] DELETE /api/users/bulk-delete
- [x] GET /api/dashboard/analytics
- [x] GET /api/dashboard/reports

---

## Validation Rules
- [x] Only @vdartinc.com emails accepted
- [x] All ticket fields are mandatory (including Location)
- [x] Ticket ID must be unique (auto-generated: TKT-XXXXX)
- [x] Only Admin can update ticket status
- [x] Bulk CSV import validates @vdartinc.com email format per row

---

## SLA Requirements
- [x] Acknowledgment email sent within 15 minutes
- [x] Track ticket creation time (timestamps)
- [x] Track first response time (SLA monitor)
- [x] SLA compliance rate visible in Reports page

---

## Technical Features Implemented
- **Passwordless OTP Login**: SHA-256 hashed 6-digit codes sent via Gmail SMTP. 5-minute expiry. Single-use invalidation.
- **Admin Dev Backdoor**: `admin@vdartinc.com` receives OTP in API response during development. Clearly marked for removal before production.
- **No-Email Onboarding**: Admin creates users silently. Password shown once with Copy button. Shared manually via ticket system only.
- **Bulk CSV Import**: Extended 9-column format. MongoDB `bulkWrite` upsert. Validates email domain per row.
- **Bulk User Delete**: Multi-select with floating action bar, confirmation modal, self-deletion safety check.
- **Analytics Dashboard**: MongoDB aggregation-powered breakdowns by status, priority, and category.
- **Reports Dashboard**: Avg resolution time, SLA compliance rate, top issue categories, agent performance rankings.
- **Enterprise Table UI**: Fixed-layout tables with `#1F4E79` headers, ellipsis overflow, hover effects, centered checkboxes.
- **Location Field**: Hybrid custom dropdown with Font Awesome icons. Conditional text input for custom locations.
- **On-Site Accountability**: Fraud-proof "Resolution Handshake" workflow.
- **Bidirectional Email**: Native IMAP/SMTP integration using `imapflow`.
- **Auto-Resolution Cron**: Auto-closes tickets after 24 hours of inactivity.
- **Smart Priority Scoring**: Mathematical priority algorithm via impact formulas.
- **Duplicate Detection**: Debounced search suggests pre-existing issues during ticket creation.
- **Real-time Notifications**: Socket.io integration for instant system-wide updates.
- **Auto Ticket Assignment**: Load-balancing assignment based on active agent queue sizes.
- **Priority-based Escalation**: SLA breach detection, countdown tracking, auto-escalation.
- **File Attachments**: Secure Multer-based file uploads.
- **Live Ticket Chat**: Real-time bidirectional comment threads via WebSockets.

---

## Technical Documentation
1. [The Knowledge-Based Priority Engine](./KNOWLEDGE_PRIORITY.md) — 3-Layer scoring algorithm, text analysis rules, Historical Learning Layer.
2. [Executive Hierarchy Design](./ORG_HIERARCHY_DESIGN.md) — VIP weighting, fast-track assignment bypassing, HR routing confidentiality.

---

## Future Enhancements
- AI-based resolution suggestions
- Mobile application deployment
- Email poller re-enable after fresh IMAP App Password

---

## Default Credentials (for testing)

> Login uses OTP — enter the email below on the login page. For `admin@vdartinc.com` in dev mode, the OTP is returned directly in the API response.

| Entity | Role | Email |
| :--- | :--- | :--- |
| **System Admin** | Admin (Central) | `admin@vdartinc.com` |
| **IT Admin** | Admin (IT only) | `itadmin@vdartinc.com` |
| **Test User** | Employee | `user@vdartinc.com` |
| **Support Agent 1** | Naveen Kumar | `naveen@vdartinc.com` |
| **Support Agent 2** | Thara | `thara@vdartinc.com` |
| **Support Agent 3** | Krish | `krish@vdartinc.com` |

## CSV Import Format

```csv
name,email,role,id,department,team,shift,designation,experience
John Doe,john.doe@vdartinc.com,employee,EMP001,IT,Dev Team A,morning,Software Engineer,2 years
Jane Smith,jane.smith@vdartinc.com,support_agent,EMP002,HR,HR Wing,afternoon,HR Specialist,4 years
```

> [!NOTE]
> **IT Admin Access:** The IT Admin (`itadmin@vdartinc.com`) has restricted access to only view and manage tickets in the **IT Department**. They are responsible for assigning these tickets to the IT Support Team.

---

## 🔐 Security & Authentication Protocol

### Passwordless OTP Login (All Employees)

VDesk uses a strictly **passwordless authentication flow** for all general application access. No employee is required to remember or enter a password to log in to the portal.

**Login Flow:**

1. Employee navigates to `/login` and enters their `@vdartinc.com` email address.
2. The backend verifies the email exists in the `User` collection and that the account is `isActive: true`.
3. A **6-digit OTP** is generated, hashed with SHA-256, and sent to the employee's registered Gmail via NodeMailer (SMTP App Password).
4. The employee copies the OTP from their inbox and pastes it into the application.
5. The backend verifies the hash. On success, a **JWT token** is issued and the session begins.
6. The OTP expires after **5 minutes** and is invalidated immediately after a single successful use.

> **Unknown or inactive emails are rejected.** If an employee's email is not found in the database, the system returns: `"No active account found. Please contact your Admin."` — no OTP is generated and no email is sent.

### Admin Gatekeeper Model (Password Management)

System passwords stored in the database are **not used for portal login**. They serve a separate, controlled purpose:

- When an Admin creates a user (single or bulk CSV), the password is **stored securely (bcrypt-hashed)** in the database.
- **No password email is ever sent automatically** to the employee.
- The generated password is displayed **once** on the Admin's screen with a Copy button immediately after user creation. It is never retrievable again from the UI.
- If an employee requires their system password for **external company tool access** (e.g., VPN, internal systems), they must raise a support ticket through the portal.
- The Admin or Support Agent reviews the ticket and **manually shares the credential** through the secure ticketing channel — never via email or chat.

This model ensures that credential distribution is fully auditable and traceable through the ticket system.

---

## 🚀 Transitioning to Production

### Step 1 — Disable the Developer Backdoor

During development, `admin@vdartinc.com` uses a bypass that returns the OTP directly in the API response body instead of sending it via email. **This must be removed before any production deployment.**

**Location in codebase:**

```
backend/controllers/auth.controller.js
```

Find and **delete** the following block (clearly marked with comments):

```js
// ── DEV BACKDOOR (remove this block before production) ────────────────────
if (process.env.NODE_ENV === 'development' && normalizedEmail === 'admin@vdartinc.com') {
  return res.json({ success: true, devCode: otp, message: 'Dev mode: OTP returned directly.' });
}
// ── END DEV BACKDOOR ──────────────────────────────────────────────────────
```

**Also remove from the frontend:**

File: `frontend/src/pages/LoginPage.jsx`

1. Delete the `devCode` state: `const [devCode, setDevCode] = useState(null);`
2. Delete the `if (res.data.devCode)` block inside `handleSendOtp`
3. Delete the yellow dev banner JSX block marked `{/* DEV BACKDOOR BANNER */}`
4. Remove `setDevCode(null)` from the "← Change email" button `onClick` handler

### Step 2 — Configure Environment Variables for Production

Update the `.env` file on the production server with the following values:

| Variable | Development Value | Production Value | Notes |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | `development` | `production` | Disables all dev-only features including the login alert box and the `admin@vdartinc.com` OTP bypass |
| `SMTP_USER` | `itadmin2603@gmail.com` | Production Gmail address | Gmail account used to send OTP emails to all employees |
| `SMTP_PASS` | Dev App Password | Fresh 16-char App Password | Generate a new Gmail App Password at myaccount.google.com/apppasswords |
| `JWT_SECRET` | Dev secret string | Strong random 64-char string | Generate with: `openssl rand -hex 32` |
| `FRONTEND_URL` | `http://localhost:5174` | `https://yourdomain.com` | Used in CORS policy and email links |
| `MONGO_URI` | Dev Atlas cluster URI | Production Atlas cluster URI | Use a dedicated production MongoDB Atlas cluster with IP whitelist |

### Step 3 — Verify the Secure OTP Flow for All Users

Once `NODE_ENV=production` is set and the dev backdoor block is removed:

- All users including `admin@vdartinc.com` will receive their OTP **exclusively via Gmail**.
- No `devCode` field will ever appear in any API response.
- The yellow dev-mode banner on the login page will never render.
- Unknown or inactive emails will be silently rejected with a generic contact-admin message.

### Step 4 — Pre-Launch Security Checklist

- [ ] Dev backdoor block removed from `auth.controller.js`
- [ ] Dev banner and `devCode` state removed from `LoginPage.jsx`
- [ ] `NODE_ENV` set to `production` in server `.env`
- [ ] `JWT_SECRET` replaced with a cryptographically strong value
- [ ] Fresh Gmail App Password generated and set in `SMTP_PASS` and `IMAP_PASSWORD`
- [ ] MongoDB Atlas IP whitelist restricted to production server IP only
- [ ] CORS `FRONTEND_URL` updated to the live domain
- [ ] Email poller re-enabled in `server.js` if IMAP credentials are valid and required
- [ ] All default test credentials (`password`) changed or deactivated in the database
