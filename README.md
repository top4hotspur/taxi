# NI Taxi Co Platform

Phase 1.2 Next.js + Amplify-ready booking/quote platform with production email delivery via Resend.

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

## Email environment variables
Set these in Amplify Hosting (and locally for real sending):
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM="NI Taxi Co <bookings@nitaxico.com>"`
- `ADMIN_EMAIL`
- `SITE_URL=https://www.nitaxico.com`
- `SESSION_SECRET`
- `AWS_REGION`
- `DDB_TABLE_USERS`
- `DDB_TABLE_CUSTOMER_PROFILES`
- `DDB_TABLE_QUOTES`
- `DDB_TABLE_BOOKINGS`
- `DDB_TABLE_QUOTE_AUDITS`

If email vars are missing, quote operations still succeed and a structured warning is logged server-side.

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

## Scope guardrails
- Driver onboarding: not included.
- Square payments: not included.
- Reminder jobs: not included.
