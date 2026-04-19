# The Hierarchy Design: Org Weighting & Executive Escalation

---

## The Core Problem

```
CEO raises ticket:        "My laptop screen flickered once"     → marks Low
Junior Dev raises ticket: "Production server is DOWN"           → marks Critical

Basic system: Production server gets handled first ✅
Smart system needed: CEO's ticket also needs faster handling 
                     even for same-severity issues ✅
```

You need **two separate concepts** working together:

```
1. ISSUE SEVERITY    → How bad is the problem technically?
2. PERSON WEIGHT     → Who raised it — what's their business impact?
```

Neither alone is enough. Both together give you the right answer.

---

## The Hierarchy Design

First, define your org levels clearly in the system:

```
Level 5 → CEO, MD, Chairman
Level 4 → VP, Director, CTO, CFO, CMO
Level 3 → Senior Manager, Department Head, GM
Level 2 → Manager, Team Lead, HR Manager
Level 1 → Employee, Staff, Intern
```

Store this on every user's profile, including their **Org Level (1-5)**, **Designation** (e.g., CEO, Manager), **Department**, and an **Executive Status** flag.

---

---

## How the Role Modifier Actually Works

In the scoring formula you already have:

```
FinalScore = (Impact × 5) + (Urgency × 4) + (SLA Risk × 6) 
           + Role Modifier   ← THIS is where org level matters
           + Queue Bonus + Keyword Bonus
```

Expand the Role Modifier properly by assigning specific point values to each organizational level. For example, a CEO (Level 5) might receive +25 points, while a standard Employee (Level 1) receives 0.

---

### Real calculation examples

**Scenario: Same ticket, different people**

```
Ticket: "Cannot access email"
Impact: just_me     → 1 × 5 = 5
Urgency: today      → 2 × 4 = 8
SLA Risk: medium    → 2 × 6 = 12
Keyword: "email"    → +5
Queue Bonus:        → 0

Employee (Level 1):   5+8+12+0+5  = 30  → Medium
Manager (Level 2):    5+8+12+6+5  = 36  → High
HOD (Level 3):        5+8+12+12+5 = 42  → High
Director (Level 4):   5+8+12+18+5 = 48  → High
CEO (Level 5):        5+8+12+25+5 = 55  → High (near Critical)
```

Same issue. But a CEO blocked from email has **direct business impact** — board calls, investor emails, approvals stuck. The system correctly prioritizes it higher without the CEO having to explain why.

---

## The SLA Difference — Faster Response for Higher Officials

Different org levels get **different SLA deadlines** for the same priority label. As responsibility increases, the time to respond and resolve decreases.

Visual table:

| Priority | CEO/MD | Director | HOD | Manager | Employee |
|----------|--------|----------|-----|---------|----------|
| Critical | 15 min | 20 min   | 30 min | 45 min | 1 hour |
| High     | 1 hour | 2 hours  | 3 hours | 3 hours | 4 hours |
| Medium   | 4 hours| 6 hours  | 8 hours | 12 hours | 24 hours |
| Low      | 8 hours| 12 hours | 24 hours| 48 hours | 3 days |

Same "Medium" ticket — CEO gets response in 4 hours, employee gets it in 24 hours. **Automatically. No manual flagging needed.**

---

When a high-level official raises a ticket, the system automatically routes it to the most experienced personnel:

- **Executives (Level 4/5):** Automatically assigned to a Senior Agent or Admin with expertise in that specific category and the lowest current workload.
- **Management (Level 3):** Preferred assignment to Senior or Mid-level agents.
- **Standard (Level 1/2):** Standard round-robin distribution based on workload and expertise.

---

## Executive Alert System — Real-Time Escalation

When a Level 4 or 5 person raises a ticket, the system triggers immediate high-visibility alerts:

1. **Direct Admin Notification:** IT Heads and Admins receive an instant push notification identifying the executive and the issue.
2. **Real-time Dashboard Alert:** A visual alert pops up on the admin/agent dashboard specifically for executive tickets.
3. **Immediate Email/SMS:** Critical alerts are sent to ensuring the IT leadership is aware of the bottleneck.
4. **CEO Escalation:** If a Level 5 official (CEO/MD) raises a ticket, the IT Department Head is notified directly to oversee the resolution.

---

## HR Special Case — Confidential Tickets

HR tickets (payroll, harassment, disputes) require strict privacy. The system automatically marks these as **Confidential**:

- **Restricted Visibility:** Only HR-designated agents and top-level Admins can see or search for these tickets.
- **Isolation:** They are never shown in general ticket lists or queues.
- **Encryption/Protection:** Access logs are strictly maintained for all confidential ticket views.

---

## The Full Priority Flow With Org Levels

```
Ticket submitted
      ↓
Extract raiser's orgLevel from their profile
      ↓
Run keyword analysis → Keyword Bonus
      ↓
Calculate base score:
  (Impact × 5) + (Urgency × 4) + (SLA Risk × 6)
  + ORG_LEVEL_MODIFIER[orgLevel]
  + Queue Bonus + Keyword Bonus
      ↓
Determine priority label from score
      ↓
Set SLA deadline using SLA_BY_LEVEL[priority][orgLevel]
      ↓
Is orgLevel >= 4?
  YES → Trigger executive alert + assign senior agent
  NO  → Standard auto-assignment by workload + expertise
      ↓
Is category HR?
  YES → Mark confidential, restrict visibility
  NO  → Normal visibility
      ↓
Ticket enters queue sorted by FinalScore
```

---

## Frontend — Show the Org Level Clearly

In the ticket detail sidebar, show who raised the ticket with their level:

```
Raised by:  [ Avatar ] Rajesh Kumar
            CEO · Level 5 · Executive
            ⚡ Executive ticket — priority handling
```

In the admin ticket list, add a visual indicator:

```
🔺 TKT-00142  "Cannot open Excel"   CEO · Rajesh Kumar   HIGH   ⏱ 55m left
⬛ TKT-00143  "Printer not working" Employee · Priya S   LOW    ⏱ 2d left
🔺 TKT-00144  "VPN disconnecting"  Director · Amit K    HIGH   ⏱ 1h 20m left
```

The `🔺` icon instantly tells agents — this person needs faster handling.

---

## Summary — The Complete Priority Stack

```
TECHNICAL SEVERITY          ORG WEIGHT
(What is broken?)      +    (Who is blocked?)
─────────────────           ─────────────────
Keyword analysis            CEO/MD        → +25
Impact scope                Director/VP   → +18
Urgency level               Sr. Manager   → +12
SLA risk                    Manager       → +6
                            Employee      → +0

                    ↓
             FINAL SCORE
                    ↓
          Priority Label + SLA Deadline
         (SLA deadline adjusts per level)
                    ↓
    Auto-assign: Senior agent for executives,
                 standard agent for employees
                    ↓
    Alert: Immediate notify to IT Head
           if Level 4 or 5 raises ticket
```

**The key principle:** A CEO's "Low" priority ticket should still get resolved faster than an employee's "Low" priority ticket — because the **business cost of the CEO being blocked is higher**. The org level modifier + tighter SLA handles this automatically, without any human having to decide.
