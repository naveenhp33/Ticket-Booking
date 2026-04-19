# Knowledge-Based Ticket Priority System — Complete Explanation

---

## What is Knowledge-Based Priority?

Most systems let users **manually pick** a priority (Low / Medium / High / Critical).

The problem? **Everyone picks Critical.** Within a week, the system is useless.

Knowledge-based priority means the **system figures out real priority automatically** — using rules, keywords, context, history, and scoring — not just what the user claims.

---

## The 3 Layers Working Together

```
Layer 1: RULE ENGINE     → Is this a known critical pattern?
         ↓
Layer 2: SCORING FORMULA → How bad is this mathematically?
         ↓
Layer 3: LEARNING        → What does history tell us?
         ↓
      Final Priority Score → Critical / High / Medium / Low
```

---

## Layer 1 — Rule Engine (Instant Pattern Matching)

This fires **the moment** a ticket is submitted. Pure if/then logic.

### How it works

The system scans the ticket title + description for known keyword patterns and assigns a **bonus or penalty score** to each match.

```
"server down"       → +10  (critical infrastructure)
"payment issue"     → +8   (financial impact)
"data breach"       → +10  (security emergency)
"cannot login"      → +7   (blocks work)
"vpn not working"   → +7   (access/connectivity)
"client meeting"    → +6   (business deadline pressure)
"entire team"       → +8   (wide impact)
"database down"     → +9   (data risk)
"printer broken"    → -3   (low priority peripheral)
"cosmetic issue"    → -3   (visual-only, not blocking)
```

### Real example

**Ticket:** *"Server down — entire team cannot access database, client demo in 1 hour"*

```
Matched: "server down"    → +10
Matched: "entire team"    → +8
Matched: "database"       → +9
Matched: "client"         → +6
                          ─────
Keyword Bonus Total:       +33
```

That bonus alone pushes this ticket to **Critical** before any other factor is even considered.

### Why rules first?

Because some situations are **always critical regardless of what the user selected**. A server outage affecting the whole company should never be Low priority just because a junior employee didn't know to select Critical.

---

## Layer 2 — Scoring Formula (Mathematical Priority)

This is the core engine. Every ticket gets a **numeric score** calculated from 6 components.

### The Formula

```
FinalScore = (Impact × 5)
           + (Urgency × 4)
           + (SLA Risk × 6)
           + Role Modifier
           + min(Queue Bonus, 20)
           + Keyword Bonus
```

Each component explained:

---

### Component 1 — Impact Score (× 5 weight)

*"Who is affected by this issue?"*

| Employee Selects | Value | Score |
|-----------------|-------|-------|
| Just me | 1 | 5 |
| My team (2–10) | 2 | 10 |
| My whole department | 3 | 15 |
| Company-wide | 5 | 25 |

Weight is **×5** because impact on people is the most important business factor. A company-wide outage is 5× more urgent than a personal issue.

---

### Component 2 — Urgency Score (× 4 weight)

*"How time-sensitive is this?"*

| Employee Selects | Value | Score |
|-----------------|-------|-------|
| Flexible | 1 | 4 |
| Needs to be today | 2 | 8 |
| Within the hour | 4 | 16 |
| Right now — critical | 5 | 20 |

Weight is **×4** because urgency matters but is slightly less objective than impact. An employee might say "right now" for a minor inconvenience, so it's weighted slightly less than impact.

---

### Component 3 — SLA Risk Score (× 6 weight — highest weight)

*"How close are we to breaching the SLA deadline?"*

This is **dynamically calculated** — it changes as time passes.

| Time Remaining | Risk Value | Score |
|---------------|-----------|-------|
| > 24 hours | 1 | 6 |
| ≤ 24 hours | 2 | 12 |
| ≤ 4 hours | 3 | 18 |
| ≤ 1 hour | 4 | 24 |
| Already breached | 5 | 30 |

**Why SLA Risk has the highest weight (×6)?**

Because SLA is a **contractual/business obligation**. A Low priority ticket that's about to breach SLA is more urgent than a High priority ticket with 3 days left. The system automatically re-ranks tickets as time passes — no human intervention needed.

```
8 AM:  Ticket score = 22  → Medium
2 PM:  Ticket score = 34  → High     (SLA risk increased)
5 PM:  Ticket score = 52  → Critical (SLA risk increased again)
6 PM:  BREACH → Auto-escalated, agents notified
```

---

### Component 4 — Role Modifier

*"Who raised this ticket?"*

| Role | Modifier |
|------|----------|
| Employee | +0 |
| Support Agent | +3 |
| Admin | +5 |

This is **controversial but realistic**. Admins raising a ticket usually means something genuinely important is broken. It's a small modifier — it won't override a legitimately critical employee ticket, but it breaks ties.

---

### Component 5 — Queue Bonus (capped at 20)

*"How long has this ticket been waiting?"*

```
Queue Bonus = min( (age_in_hours × 0.5) + position_bonus, 20 )
```

| Waiting Time | Bonus |
|-------------|-------|
| 2 hours | +1 |
| 10 hours | +5 |
| 20 hours | +10 |
| 40+ hours | +20 (capped) |

**Why this matters:**

Without a queue bonus, a Medium priority ticket can sit at position 50 in the queue **forever** because Critical tickets keep coming in ahead of it. The queue bonus ensures old tickets gradually rise in priority — **no ticket starves**.

The cap at 20 prevents a trivial old ticket from jumping to Critical just because it's been waiting.

---

### Component 6 — Keyword Bonus

The output of Layer 1 (the rule engine) feeds directly into this component. Already explained above.

---

### Full Calculation Example

**Ticket:** *"VPN not working, entire marketing team blocked, client presentation in 2 hours"*

```
Impact:       team      → 2 × 5 = 10
Urgency:      within_hour → 4 × 4 = 16
SLA Risk:     medium (assumed new ticket, 24h SLA) → 2 × 6 = 12
Role:         employee  → +0
Queue Bonus:  new ticket → +0
Keyword:
  "vpn"                 → +7
  "entire team"         → +8
  "client"              → +6
                        ─────
Keyword Total:           +21

FinalScore = 10 + 16 + 12 + 0 + 0 + 21 = 59 → HIGH
```

Two hours later, SLA risk increases:

```
Same ticket, SLA now ≤ 4 hours remaining:
SLA Risk: 3 × 6 = 18 (was 12)

FinalScore = 10 + 16 + 18 + 0 + 2 + 21 = 67 → CRITICAL
```

**The ticket auto-escalated to Critical — without anyone touching it.**

---

### Score → Priority Label

```
Score ≥ 60   →  🔴 Critical
Score 35–59  →  🟠 High
Score 15–34  →  🟡 Medium
Score < 15   →  🟢 Low
```

---

## Layer 3 — Learning Layer (Historical Intelligence)

This is what separates a smart system from a basic one. The system learns from past data.

### 3a. Resolution Time Learning

Every time a ticket is resolved, the system logs:

```
Category: IT
Keywords: vpn, network
Resolution time: 3.5 hours
Agent: Support Agent A
```

Next time a similar ticket comes in:
- SLA is set based on **actual historical resolution time**, not just the priority label
- If "VPN issues" always take 6 hours but the SLA says 4 hours → the system flags it as high risk immediately

### 3b. Employee Trust Score (Silent)

The system tracks per-employee history:

```
Employee X — past 3 months:
  Raised 12 tickets labeled "Critical" by them
  System recalculated: 10 of those were actually Medium
  Trust modifier: -2 on urgency for this employee
```

And the opposite:

```
Employee Y — past 3 months:
  Raised 5 tickets, all legitimately critical
  Trust modifier: +1 on urgency for this employee
```

This is **invisible to the employee** — it just makes the scoring more accurate over time.

### 3c. Pattern Detection (Cluster Detection)

If 5+ tickets with the same keywords come in within 30 minutes:

```
System detects: cluster of "network", "cannot connect", "wifi"
Action: Auto-create a master ticket + link all as duplicates
        Auto-escalate to Critical (company-wide incident)
        Notify all agents immediately
```

This turns **individual complaints into incident detection**.

### 3d. Time-of-Day Intelligence

```
Ticket raised: Friday 4:55 PM
System knows: Support team ends at 5 PM, no weekend coverage
Action: Urgency score × 1.5 (near end of business day)
        Auto-notify senior agent before they log off
```

---

## How Priority Audit Trail Works

Every time priority changes — automatically or manually — it's logged permanently:

```
🟢 Low  →  🟠 High
Reason: "Keyword match: server down (+10), entire team (+8)"
Changed by: System (auto-rule)
Time: 10:32 AM

🟠 High  →  🔴 Critical
Reason: "SLA breach imminent — 45 minutes remaining"
Changed by: System (SLA monitor)
Time: 2:15 PM

🔴 Critical  →  🟠 High
Reason: "Manual override — agent verified lower impact"
Changed by: Agent Sarah
Time: 2:18 PM
```

This gives **full transparency** — employees and managers can always see exactly why a ticket has the priority it has. No black box.

---

## The Background SLA Monitor

Runs every 15 minutes silently in the background:

```
Every 15 minutes:
  1. Find all open tickets where SLA deadline ≤ 1 hour away
     → Send warning notification to agent + ticket owner
     → Notify all admins in real-time via Socket.io

  2. Find all tickets where SLA deadline has passed
     → Mark sla.breached = true
     → Auto-escalate priority to Critical
     → Log in priority audit trail

  3. Find all open tickets older than 24 hours
     → Recalculate score (queue bonus increased)
     → If score changed by >5 points, update priority
     → Log change in audit trail
```

---

## Complete Data Flow — From Ticket Submission to Priority

```
Employee types title
        ↓
[Debounced 600ms]
        ↓
Frontend calls /api/tickets/suggest-priority
        ↓
Backend runs keyword analysis on title + description
        ↓
Returns: suggestedPriority + matched keywords
        ↓
UI shows priority indicator in real-time as they type
        ↓
Employee submits ticket
        ↓
Backend calculates FULL score (all 6 components)
        ↓
Auto-assigns to best available agent (workload + expertise)
        ↓
SLA deadline set based on final priority
        ↓
Ticket enters agent queue — SORTED BY SCORE (not time)
        ↓
Every 15 minutes: SLA monitor recalculates all active tickets
        ↓
Score changes → Priority updates → Agents see re-ranked queue
        ↓
Ticket resolved → Feedback collected → History updated
```

---

## Summary: Why Each Part Exists

| Component | Problem it solves |
|-----------|------------------|
| Keyword rules | Catches obvious critical situations users mis-label |
| Impact score | Quantifies how many people are blocked |
| Urgency score | Captures time pressure from the employee's perspective |
| SLA risk score | Ensures contractual deadlines drive ranking over time |
| Role modifier | Gives weight to tickets from senior/technical users |
| Queue bonus | Prevents low-priority tickets from waiting forever |
| Audit trail | Full transparency — nobody can question why |
| SLA monitor | Auto-escalates and auto-notifies without human action |
| Learning layer | System gets smarter and more accurate over time |
| Cluster detection | Turns repeated individual tickets into incident alerts |

The result: **no ticket is ever stuck, no critical issue is ever buried, and the support team always works on the right thing first** — automatically.
