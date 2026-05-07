# Support Model — 30/60/90 Day Plan

## Support Channels

| Channel | Availability   | Response Time            | Use For                             |
| ------- | -------------- | ------------------------ | ----------------------------------- |
| Email   | 24/7 intake    | 4 hours (business hours) | Non-urgent issues, feature requests |
| Chat    | Business hours | 30 minutes               | Quick questions, workflow guidance  |
| Phone   | Business hours | Immediate                | Urgent issues, onboarding support   |
| In-App  | 24/7 intake    | Next business day        | Bug reports, feedback               |

Business hours: Monday–Friday, 9:00–18:00 local time (adjust per market).

---

## Days 1–30: High-Touch Launch Support

### Focus

Ensure Tenant #1 (and any beta tenants) are successful with daily operations.

### Staffing

- 1 dedicated support person (can be founding team member)
- Engineering team on standby for escalations

### Activities

- **Daily check-in** with each active tenant (15 min call or chat)
- **Same-day response** for all support requests
- **Proactive monitoring**: Review platform admin dashboard daily for:
  - Failed login attempts
  - Stuck rentals (active > 48 hours without interaction)
  - Error rates in health endpoints
  - Asset utilization rates
- **Weekly report** to each tenant:
  - Rental volume and completion rate
  - Top issues encountered
  - Upcoming platform improvements
- **Bug fixes**: Critical bugs fixed within 24 hours

### Response Windows

| Priority                   | Response   | Resolution   |
| -------------------------- | ---------- | ------------ |
| Critical (can't operate)   | 30 minutes | 2 hours      |
| High (workflow blocked)    | 1 hour     | 4 hours      |
| Medium (workaround exists) | 4 hours    | 24 hours     |
| Low (nice-to-have)         | 24 hours   | Next release |

### Success Criteria for Day 30

- [ ] All tenants completing daily operations independently
- [ ] Average support tickets per tenant < 3 per week
- [ ] No unresolved critical or high-priority issues
- [ ] Tenant satisfaction score > 7/10

---

## Days 31–60: Stabilization & Self-Service

### Focus

Reduce support dependency by building self-service resources and establishing sustainable support patterns.

### Staffing

- 1 support person (part-time may suffice if volume is low)
- Engineering support via ticket escalation

### Activities

- **Bi-weekly check-in** with each tenant (replace daily cadence)
- **Knowledge base development**:
  - Common FAQ answers documented
  - Step-by-step guides for core workflows
  - Troubleshooting guide for common issues
  - Video walkthroughs for complex features
- **Support ticket system**: Formalize intake and tracking
- **Triage cadence**: Review open tickets daily, prioritize weekly
- **Pattern analysis**: Identify recurring issues → fix root causes or improve UX
- **New tenant onboarding**: Each new tenant gets 1-week high-touch support (Days 1–30 model)

### Response Windows

| Priority | Response | Resolution   |
| -------- | -------- | ------------ |
| Critical | 1 hour   | 4 hours      |
| High     | 2 hours  | 8 hours      |
| Medium   | 8 hours  | 48 hours     |
| Low      | 24 hours | Next release |

### Success Criteria for Day 60

- [ ] Knowledge base covers 80% of common questions
- [ ] Average support tickets per tenant < 2 per week
- [ ] 50%+ of tickets resolved via self-service resources
- [ ] Onboarding time for new tenants < 1 hour
- [ ] No SEV-1 incidents in past 30 days

---

## Days 61–90: Scalable Support Operations

### Focus

Establish repeatable support operations that scale with tenant growth.

### Staffing

- Support capacity planning: 1 FTE per 20–30 active tenants
- Defined escalation path: Support → Engineering → CTO

### Activities

- **Monthly check-in** with each tenant (strategic, not tactical)
- **Automated monitoring alerts**: Proactive issue detection
- **Support SLA formalization**:
  - Response time guarantees per plan tier
  - Uptime commitments (99.5% target)
  - Escalation procedures documented and tested
- **Feedback loop**: Monthly review of support trends → product roadmap input
- **Community building** (if scale warrants):
  - Tenant community channel (Slack/Discord)
  - Monthly product update newsletter
  - Feature request voting board

### Response Windows (Standard SLA)

| Priority | Starter Plan | Growth Plan | Enterprise Plan |
| -------- | ------------ | ----------- | --------------- |
| Critical | 4 hours      | 2 hours     | 1 hour          |
| High     | 8 hours      | 4 hours     | 2 hours         |
| Medium   | 24 hours     | 12 hours    | 8 hours         |
| Low      | 72 hours     | 48 hours    | 24 hours        |

### Success Criteria for Day 90

- [ ] Support operations sustainable without founder involvement in daily tickets
- [ ] Average resolution time < 12 hours for non-critical issues
- [ ] Tenant churn rate < 5%
- [ ] NPS score > 40
- [ ] Self-service resolution rate > 60%
- [ ] Support cost per tenant is viable for pricing model

---

## Escalation Levels

### Level 1: Support Team

- Password resets, login issues
- Workflow questions and guidance
- Data entry assistance
- Feature usage explanation

### Level 2: Senior Support / Ops

- Billing disputes and adjustments
- Tenant moderation decisions
- Data import issues
- Complex workflow problems

### Level 3: Engineering

- Bug fixes and hotfixes
- Performance issues
- Integration problems
- Security concerns

### Level 4: Leadership

- Tenant escalation (unhappy customer)
- Legal / compliance issues
- Platform-wide incidents
- Strategic product decisions

---

## Triage Process

### Daily Triage (15 minutes)

1. Review all new tickets from past 24 hours
2. Assign priority level based on impact
3. Route to appropriate level
4. Update ticket status
5. Follow up on aging tickets (> 48 hours)

### Weekly Review (30 minutes)

1. Review all open tickets
2. Identify patterns and recurring issues
3. Escalate stuck tickets
4. Update knowledge base with new solutions
5. Report metrics: volume, resolution time, satisfaction
