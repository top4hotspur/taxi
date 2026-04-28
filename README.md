# NI Taxi Co Website

Professional enquiry-led website for **www.NITaxiCo.com**, built with Next.js App Router, TypeScript, and Tailwind CSS.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- ESLint
- Static pages + API route placeholder (`POST /api/quote`)

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production Build

```bash
npm run lint
npm run build
npm start
```

## Routes

- `/`
- `/services`
- `/airport-transfers`
- `/golf-transfers`
- `/tours`
- `/quote`
- `/api/quote` (POST)
- `/robots.txt`
- `/sitemap.xml`

## Deployment to AWS Amplify Hosting

1. Push this repository to GitHub.
2. In AWS Amplify Hosting, connect the repository and target branch.
3. Use default build settings for Next.js SSR/App Router.
4. Confirm environment variables if added later (email/CRM integrations).
5. Deploy and validate all routes and the quote form submission endpoint.

## Notes for Phase 2

The project structure is prepared to add:

- Email notifications from quote submissions
- CRM integration
- Admin dashboard
- Pricing engine
- Booking calendar
