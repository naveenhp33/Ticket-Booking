# VDesk — Premium IT Support Hub (v1.1)

## Project Info
- **Project:** VDesk — IT Support & Asset Management System
- **Client:** VDart (Internal)
- **Stack:** MERN (MongoDB, Express.js, React.js, Node.js)
- **Version:** 1.1

---

## User Roles

### Employee
- [x] Login using @vdartinc.com email only
- [x] Raise IT support ticket (Portal or Email)
- [x] **New:** Confirm Agent Arrival for on-site visits
- [x] **New:** Verify Resolution ("Handshake") before ticket closure
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

---

## Pages Build Status

### Frontend (React.js)
- [x] Login Page / Register Page
- [x] Employee Dashboard
- [x] Ticket Creation Form
- [x] Ticket Tracking Page
- [x] Admin Dashboard

### Backend APIs (Node.js + Express.js)
- [x] POST /api/auth/login
- [x] POST /api/tickets/create
- [x] GET /api/tickets
- [x] PATCH /api/tickets/:id/status
- [x] POST /api/email/send (Integrated in flow)

---

## Validation Rules
- [x] Only @vdartinc.com emails accepted
- [x] All ticket fields are mandatory
- [x] Ticket ID must be unique (auto-generated: TKT-XXXXX)
- [x] Only Admin can update ticket status

---

## SLA Requirements
- [x] Acknowledgment email sent within 15 minutes (Integrated into system)
- [x] Track ticket creation time (timestamps)
- [x] Track first response time (SLA monitor)

---

## Technical Features Implemented
- **On-Site Accountability**: Fraud-proof "Resolution Handshake" workflow where agents must have arrival and completion verified by the employee.
- **Bidirectional Email**: Native IMAP/SMTP integration using `imapflow` for ticket creation and threaded replies.
- **Auto-Resolution Cron**: Background service that monitors pending confirmations and automatically closes tickets after 24 hours of inactivity.
- **Smart Priority Scoring**: Intelligent algorithm mathematically determining root ticket weight via impact formulas.
- **Duplicate Detection**: Intercepts the employee creation flow via debounced searches to suggest pre-existing issues.
- **Executive Escalations**: Hierarchy-aware workflows bypassing standard user queues to alert the Head of IT instantly.
- **Real-time Notifications**: Socket.io integration for instant system-wide status updates.
- **Advanced UI**: Typography-first redesign (Inter font-face) with premium micro-animations.
- **Dashboard Analytics**: Advanced charting/visuals for systemic Admin and Agent Dashboard views.
- **Auto Ticket Assignment**: Intelligent load-balancing assignment algorithms based on active agent queue sizes.
- **Priority-based Escalation**: Automated SLA breach detection, countdown tracking, and priority auto-escalation.
- **File Attachments**: Secure Multer-based file uploads appended natively to tickets.
- **Live Ticket Chat**: Real-time bidirectional conversation threads using comments & WebSockets.

---

## Technical Documentation
For a comprehensive architectural deep-dive into the custom intelligence mechanics powering this ticketing system, please refer to the following internal documents:
1. [The Knowledge-Based Priority Engine](./KNOWLEDGE_PRIORITY.md) — Outlines the 3-Layer scoring algorithm, text analysis rules, and the Historical Learning Layer.
2. [Executive Hierarchy Design](./ORG_HIERARCHY_DESIGN.md) — Details organizational VIP weighting, fast-track assignment bypassing, and strict HR routing confidentiality.

---

## Future Enhancements
- AI-based resolution suggestions
- Mobile application deployment

---

## Default Credentials (for testing)

**Common Password:** `password`

| Entity | Role | Email |
| :--- | :--- | :--- |
| **System Admin** | Admin (Central) | `admin@vdartinc.com` |
| **IT Admin** | Admin (IT only) | `itadmin@vdartinc.com` |
| **Test User** | Employee | `user@vdartinc.com` |
| **Support Agent 1** | Naveen Kumar | `naveen@vdartinc.com` |
| **Support Agent 2** | Thara | `thara@vdartinc.com` |
| **Support Agent 3** | Krish | `krish@vdartinc.com` |


> [!NOTE]
> **IT Admin Access:** The IT Admin (`itadmin@vdartinc.com`) has restricted access to only view and manage tickets in the **IT Department**. They are responsible for assigning these tickets to the IT Support Team.




