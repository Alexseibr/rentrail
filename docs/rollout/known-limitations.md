# Known Limitations at Launch

This document lists features and capabilities that are explicitly **not included** at launch. Share this with tenants during onboarding to manage expectations.

---

## Not Available at Launch

### Customer-Facing Features

- **No end-customer mobile app**: Clients (renters) interact via public web pages or in-person with staff. A client-facing mobile app is not included.
- **No online booking/reservation by clients**: Rentals are created by staff on behalf of clients. Self-service booking is planned for a future release.
- **No online payment by clients**: Payments are recorded by staff after collecting payment in person or via external payment processor. Integrated payment gateway (Stripe) is planned.
- **No automated email/SMS notifications to clients**: Staff-side notifications work. Client-facing automated communications (rental confirmations, overdue reminders) require email/SMS provider integration.

### Fleet & Operations

- **No real-time GPS tracking map**: Telemetry data from IoT devices is stored, but there is no live map view for tracking vehicle locations. GPS data can be viewed per-device.
- **No automated fleet rebalancing**: No automated suggestions for moving vehicles between stations based on demand. This is a manual process.
- **No predictive maintenance**: Maintenance scheduling is manual. Automated alerts based on usage patterns or device telemetry are not included.
- **No geofencing enforcement**: Geofence definitions can be stored but automatic actions (alerts, lock commands) on boundary violations are not enforced at launch.
- **No automated device commands**: Lock/unlock commands can be defined but actual IoT device communication requires device-specific integration not included at launch.

### Billing & Payments

- **No integrated payment gateway**: SaaS billing (platform → tenant) and rental payments (tenant → client) are tracked but payment collection is manual. Stripe integration is on the roadmap.
- **No automated invoicing schedule**: SaaS invoices are created manually or via platform admin. Automated monthly billing cycles are planned.
- **No multi-currency support**: Each tenant operates in a single currency. Cross-currency conversions and multi-currency invoicing are not supported.
- **No tax calculation**: Tax amounts must be included in prices manually. Automated tax calculation by jurisdiction is not included.

### Reporting & Analytics

- **No downloadable reports**: Dashboard shows metrics but PDF/Excel report export is not available. Data can be extracted via API for external reporting.
- **No custom dashboards**: Dashboard layout and metrics are fixed. Customizable widgets or tenant-configurable dashboards are not included.
- **No revenue forecasting**: Historical revenue data is available but predictive analytics are not included.

### Integrations

- **No third-party integrations**: No pre-built integrations with accounting software (QuickBooks, Xero), CRM systems, or marketing tools.
- **No public API for tenants**: The API is internal. Tenant-facing API access with API keys is planned for future release.
- **No webhook system**: No event-driven notifications to external systems. Planned for future release.
- **No SSO/SAML**: Authentication is email/password only. Enterprise SSO integration is not included at launch.

### Platform Administration

- **No automated tenant provisioning**: Tenant setup requires manual steps via platform admin. Fully self-service signup with automatic provisioning is partially implemented but not production-ready.
- **No automated data export on cancellation**: When a tenant cancels, data export must be performed manually by platform admin.
- **No multi-region deployment**: Single deployment region. Multi-region for latency optimization is not included.

---

## Known Technical Constraints

### Performance

- API rate limiting is not enforced (rely on reasonable usage during early phases)
- Large asset fleets (500+ per tenant) may experience slower list loading
- Concurrent rental creation for the same asset relies on database-level conflict detection

### Data

- No point-in-time recovery (depends on backup schedule)
- Audit log retention is unlimited (may need pruning strategy for large tenants)
- File upload size limit depends on object storage configuration

### Mobile App (Staff)

- Push notifications require valid APNs/FCM credentials
- Offline mode is not supported — requires internet connection
- Camera/photo features require device permissions granted by user

---

## Planned for Next Releases

| Feature                           | Priority | Estimated Timeline |
| --------------------------------- | -------- | ------------------ |
| Stripe payment integration        | High     | Phase 2–3          |
| Automated SaaS invoice scheduling | High     | Phase 2            |
| Client email/SMS notifications    | High     | Phase 2            |
| CSV/Excel report exports          | Medium   | Phase 2            |
| Real-time GPS tracking map        | Medium   | Phase 3            |
| Self-service client booking       | Medium   | Phase 3            |
| Public tenant API                 | Medium   | Phase 3+           |
| Webhook system                    | Low      | Phase 3+           |
| Multi-currency billing            | Low      | Phase 3+           |
| Enterprise SSO/SAML               | Low      | Phase 3+           |
