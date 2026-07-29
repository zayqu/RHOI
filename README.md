# RHOI

RHOI is a mobile-first loan management and repayment tracking system designed for a small lender. The interface uses the RHOI brand green `#B6E53F` and defaults all money displays to Tanzanian shillings.

## Included

- Portfolio dashboard with collections, overdue balances and priority follow-ups
- Client register with Tanzanian phone-number normalization
- Loan creation with flat-rate, reducing-balance, interest-free and fixed-total schedules
- Weekly, biweekly, monthly and single-repayment schedules
- Payment entry with penalty → fees → interest → principal allocation
- Traceable receipt records and reversal-ready financial model
- Follow-up queue, promises to pay, reports and exports
- Owner, staff and auditor roles in the Supabase schema
- Organization-scoped row-level security
- Integer-money calculations and automated finance tests
- Installable mobile PWA shell

## Run locally

```bash
npm install
npm run test
npm run dev
```

## Production setup

1. Create a free Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL and anonymous key.
4. Create the first organization and owner profile after signing up the first user.
5. Import this repository into Vercel. The included `vercel.json` builds the Vite application.

The current interface includes realistic demonstration records so the workflow can be evaluated immediately. The SQL schema is the production persistence and authorization foundation; connecting the forms to a live Supabase project requires the project URL and anonymous key.

## Important operating rules

- Never modify or delete a posted payment. Create a reversing payment and then enter the replacement.
- Keep transaction references unique.
- Review overdue accounts daily and document every promise to pay.
- Export periodic backups from Supabase and keep them securely.
- WhatsApp uses click-to-chat for manual messages; no paid messaging automation is assumed.
