# IT Support Ticket Management System — Requirements (v1.1)

## Project Info
- **Project:** IT Support Ticket Management System
- **Client:** VDart (Internal)
- **Stack:** MERN (MongoDB, Express.js, React.js, Node.js)
- **Version:** 1.1

---

## User Roles

### Employee
- [x] Login using @vdartinc.com email only
- [x] Raise IT support ticket
- [x] View all submitted tickets
- [x] Check ticket status
- [x] Receive acknowledgment email on ticket creation
- [x] Receive resolution email when ticket is resolved

### Admin
- [x] Login to admin dashboard
- [x] View all tickets from all employees
- [x] Filter tickets by status
- [x] Update ticket priority (Low / Medium / High)
- [x] Update ticket status (Open → In Progress → Resolved → Closed)
- [x] Send acknowledgment email within 15 minutes (SLA)
- [x] Send resolution email when ticket is closed

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
- **Smart Scoring**: Auto-priority based on impact/urgency
- **Real-time Notifications**: Socket.io integration
- **Advanced UI**: Typography-first redesign (Inter font-face)
- **Dashboard Analytics**: Analytics visuals for Admin

---

## Future Enhancements
- Auto ticket assignment
- Priority-based escalation
- Real-time chat
- File attachments
- Dashboard analytics
