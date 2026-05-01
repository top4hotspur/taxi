# NI Taxi Co Platform

Phase 3 Next.js + Amplify-ready booking/quote platform with production email delivery and driver compliance reminders.

## Stack
- Next.js App Router + TypeScript + Tailwind
- AWS Amplify Gen 2 backend scaffolding (`amplify/`)
- DynamoDB-backed persistence via server API adapter (`src/lib/db.ts`)
- Cookie session auth contract (login/register/account/admin flows)
- Resend email delivery (`src/lib/email/sendEmail.ts`)

## Local run
```bash
npm install
npm run dev
```

## Quality checks
```bash
npm run lint
npm run build
```

## Key routes
- `/quote`
- `/account`
- `/account/quotes/[id]`
- `/admin`
- `/admin/quotes`
- `/admin/quotes/[id]`
- `/admin/customers`
- `/driver`
- `/driver/profile`
- `/driver/documents`
- `/driver/availability`
- `/admin/drivers`
- `/admin/drivers/[id]`

## Email environment variables
Set these in Amplify Hosting (and locally for real sending):
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM="NI Taxi Co <bookings@nitaxico.com>"`
- `ADMIN_EMAIL`
- `SITE_URL=https://www.nitaxico.com`
- `SESSION_SECRET`
- `APP_AWS_REGION=eu-west-2`
- `APP_AWS_ACCESS_KEY_ID`
- `APP_AWS_SECRET_ACCESS_KEY`
- `DDB_TABLE_USERS`
- `DDB_TABLE_CUSTOMER_PROFILES`
- `DDB_TABLE_QUOTES`
- `DDB_TABLE_BOOKINGS`
- `DDB_TABLE_QUOTE_AUDITS`
- `DDB_TABLE_DRIVER_PROFILES`
- `DDB_TABLE_DRIVER_DOCUMENTS`
- `DDB_TABLE_DRIVER_REMINDER_LOGS`
- `DDB_TABLE_PRICING_SETTINGS`
- `DDB_TABLE_PRICING_TIME_UPLIFTS`
- `DDB_TABLE_PRICING_DATE_UPLIFTS`
- `DDB_TABLE_ANALYTICS_EVENTS=ni-taxi-analytics-events`
- `ANALYTICS_SALT` (optional, recommended for IP hashing)
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `GOOGLE_ROUTES_API_KEY`

If email vars are missing, quote operations still succeed and a structured warning is logged server-side.

Temporary SSR/API DynamoDB credentials note:
- `APP_AWS_ACCESS_KEY_ID` and `APP_AWS_SECRET_ACCESS_KEY` are a temporary server-side unblock for environments where runtime credentials are unavailable.
- TODO: replace this with IAM role/AppSync/Amplify Data client pattern before long-term production hardening.
- Use a least-privilege IAM key scoped only to required DynamoDB table actions and rotate it regularly.

## Production deployment notes

### 1) Deploy Amplify backend resources
1. `npx ampx sandbox` (dev sandbox)
2. `npx ampx pipeline-deploy --branch <branch>` (CI/prod path)
3. Confirm `amplify/data/resource.ts` and `amplify/auth/resource.ts` deploy successfully.

### 2) Cognito groups and first admin
Required groups:
- `customer`
- `admin`
- `driver` (reserved)

First admin user:
1. Register user in app.
2. Add user to Cognito `admin` group.
3. Verify `/admin` access.

### 3) Resend setup
1. Create/verify sender domain in Resend.
2. Add DNS records from Resend (SPF/DKIM/verification) at your DNS host.
3. Confirm sender address matches `EMAIL_FROM`.
4. Add `RESEND_API_KEY` and `ADMIN_EMAIL` in Amplify environment variables.
5. Redeploy Amplify app.

### 4) Quote persistence and email test checklist
1. Submit guest quote on `/quote`.
2. Confirm guest sees success message and (when configured) confirmation email.
3. Confirm admin receives new quote notification email.
4. Register/login, submit customer quote.
5. From admin, mark quote `QUOTE_SENT`; confirm customer email.
6. Customer accepts quote; confirm customer + admin emails.
7. Customer declines another quote; confirm admin email.
8. Admin creates booking; confirm admin internal email.
9. Admin confirms booking; confirm customer email includes journey summary and driver-details placeholder.
10. Verify quote/audit/booking records in DynamoDB.

### 5) Driver compliance reminders (Phase 3)
1. Ensure `ADMIN_EMAIL`, `SITE_URL`, and Resend variables are configured.
2. Open `/admin/drivers` as an admin user.
3. Click `Run driver compliance reminders`.
4. Confirm summary counts are returned and emails are sent/logged.
5. Confirm reminder dedupe in `DriverReminderLog` records.

Temporary implementation:
- Manual admin endpoint: `POST /api/admin/reminders/driver-compliance/run`
- Future scheduled version: move to daily EventBridge + Amplify scheduled function trigger.

### 6) Google Maps Places Autocomplete setup
1. Create a Google Cloud project.
2. Enable `Maps JavaScript API`.
3. Enable `Places API` (and `Places API (New)` if your project uses new Places quotas/features).
4. Create a browser API key.
5. Ensure billing is enabled in Google Cloud.
6. Restrict key by HTTP referrer:
   - `https://www.nitaxico.com/*`
   - `https://nitaxico.com/*`
   - `https://main.d2pzev9psl5h1s.amplifyapp.com/*`
   - `http://localhost:3000/*`
7. Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to Amplify environment variables.
8. Redeploy.

If the key is missing or the script fails to load, quote form location fields automatically fall back to manual text input.

### 6.1) Instant route-based pricing setup
1. Enable `Routes API` in Google Cloud.
2. Create a server-side API key for routes calls.
3. Restrict the key as tightly as possible (server/runtime usage only where supported).
4. Add `GOOGLE_ROUTES_API_KEY` to Amplify environment variables.
5. Redeploy so Amplify writes runtime vars into `.env.production`.

### 6.2) Configurable pricing rules
1. Use `/admin/pricing` to manage base fare and uplift rules.
2. Time uplift bands support active/inactive percentages by time window.
3. Date uplift rules support single date, date range, and recurring annual date.
4. Estimated pricing remains customer-facing guidance; admins can override final quoted price before sending.

Google Places diagnostics:
- If the UI shows address search unavailable, open browser console and check `[place-autocomplete-diagnostics]` entries.
- In development mode, field-level diagnostics appear below the input.
- Common causes:
  - key missing
  - referrer restriction mismatch
  - Places API disabled
  - billing/project configuration issues

### 7) Quote troubleshooting commands
Use these to diagnose live submission issues:

```bash
curl -i -X POST https://www.nitaxico.com/api/quote \
  -H "Content-Type: application/json" \
  -d '{"name":"Diag User","email":"diag@example.com","phone":"123","serviceType":"Airport transfer","pickupLocation":"Belfast","dropoffLocation":"Dublin Airport","pickupDate":"2026-05-01","pickupTime":"09:30","passengers":"2"}'
```

```bash
curl -i -X POST https://<your-amplify-temp-domain>.amplifyapp.com/api/quote \
  -H "Content-Type: application/json" \
  -d '{"name":"Diag User","email":"diag@example.com","phone":"123","serviceType":"Airport transfer","pickupLocation":"Belfast","dropoffLocation":"Dublin Airport","pickupDate":"2026-05-01","pickupTime":"09:30","passengers":"2"}'
```

```bash
nslookup www.nitaxico.com 8.8.8.8
nslookup www.nitaxico.com
```

CloudWatch correlation troubleshooting:
1. Copy `correlationId` from API error response.
2. In CloudWatch Logs, open the Amplify SSR function log group for your environment.
3. Search for the correlation id string to locate the exact DynamoDB write diagnostic record.
4. Review logged fields: operation, table env var name, table name, AWS error name/message, and HTTP status code.

## First-party analytics notes
- Events are captured via `POST /api/analytics/event`.
- Raw IP addresses are not stored; an `ipHash` is stored using `ANALYTICS_SALT` (or `SESSION_SECRET` fallback).
- Admin analytics dashboard is available at `/admin/analytics`.
- Current funnel events:
  - `PAGE_VIEW`
  - `QUOTE_STARTED`
  - `QUOTE_ESTIMATE_CALCULATED`
  - `QUOTE_SUBMITTED`
  - `CUSTOMER_REGISTER_STARTED`
  - `CUSTOMER_REGISTERED`
  - `DRIVER_REGISTER_STARTED`
  - `DRIVER_REGISTERED`

## Scope guardrails
- Driver onboarding: not included.
- Square payments: not included.
- Driver reminders: manual admin trigger included; scheduled jobs not included yet.
