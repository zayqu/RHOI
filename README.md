# RHOI

RHOI is a mobile-first loan and repayment system for a small Tanzanian lender. It uses React, strict TypeScript, Supabase PostgreSQL/Auth/RLS, and Vercel. Money is stored as integer TZS.

## Production capabilities

- Secure owner sign-up, sign-in, sign-out, password recovery, session handling, and organization-scoped RLS
- Client creation, editing, status control, Tanzanian phone normalization, and duplicate-phone intelligence
- Atomic loan creation with generated flat, reducing-balance, interest-free, and fixed-total schedules
- Weekly, biweekly, monthly, and single-payment frequencies
- Atomic full, partial, and overpayment allocation in penalty → fees → interest → principal order
- Immutable receipts and reversal entries; posted payments are never updated or deleted
- Live balances, overdue detection, seven-day dues, collections chart, search, and CSV reports
- Follow-up records, promises to pay, next actions, and overdue priority queue
- Advisory-only portfolio intelligence that cannot modify financial records
- Installable PWA shell with safe read-only offline caching

## Required Supabase setup

Run these files once, in order, in the Supabase SQL Editor:

1. `supabase/schema.sql`
2. `supabase/002_auth_bootstrap.sql`
3. `supabase/003_financial_operations.sql`

The third migration is idempotent and adds atomic loan/payment/reversal functions and business audit triggers.

Set these Vercel Production environment variables:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
```

Both values are intentionally browser-visible. Never expose a Supabase service-role key.

In Supabase Authentication → URL Configuration, set the Site URL to the production RHOI URL and add that URL to Redirect URLs. In Vercel, Production Deployment Protection must not require a Vercel account, otherwise mobile email-confirmation links are intercepted by Vercel.

## Email identity

Until RHOI owns a domain, authentication email uses Supabase’s shared sender and is suitable only for owner/testing traffic. A branded `@rhoi-domain` sender requires a verified domain and custom SMTP. This is an account configuration, not an application secret.

## Development and verification

```bash
npm install
npm run build
npm run test -- --run
```

The tests cover integer-money schedules, allocation order, phone duplicate detection, overdue priorities, and unallocated-payment warnings.

## Operating controls

- Use reversals for payment corrections.
- Require a unique transaction reference for non-cash payments.
- Confirm all advisory recommendations before acting.
- Export CSV reports regularly and use Supabase database backups.
- Automated WhatsApp/SMS is not included because production delivery is not genuinely free. Manual communication remains staff-controlled.
- Legal terms, interest, penalties, privacy wording, and retention periods require review for the lender’s Tanzanian circumstances.

## Zero-cost boundary

Core calculations and intelligence require no paid AI API. Generative AI is deliberately not allowed to calculate interest, approve loans, change balances, impose penalties, delete records, or send sensitive messages. It can be added later as an optional provider only after a genuinely free or user-owned model endpoint is chosen.
