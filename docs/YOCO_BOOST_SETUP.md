# Yoco Gateway + Supabase Edge Function Webhook Setup

This project uses **Yoco Gateway (checkout API)** for paid boosts and **Supabase Edge Functions** as the webhook endpoint.

## 1) App env vars (Next.js)

Add to `.env.local` (local) and your deployment env:

```env
YOCO_SECRET_KEY=sk_test_or_live_xxx
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
YOCO_WEBHOOK_URL=https://<project-ref>.supabase.co/functions/v1/yoco-webhook
```

Optional:

```env
YOCO_API_BASE_URL=https://payments.yoco.com/api
BOOST_ALLOW_MANUAL_CONFIRM=true
```

`YOCO_WEBHOOK_URL` is now used by `POST /api/boosts/checkout` when creating checkout sessions.
If you are still in testing and do not have a public webhook URL yet, you can leave `YOCO_WEBHOOK_URL` unset.
In that case, the app uses temporary manual confirmation on return from checkout.

## 2) Database migrations (Supabase SQL)

Run these in order:

1. `db/migrations/019_boosts.sql`
2. `db/migrations/020_boost_payments.sql`
3. `db/migrations/021_boost_webhook_rpc.sql`

The third migration adds `public.process_boost_payment_webhook(...)`, which the Edge Function calls.

## 3) Edge Function deploy (Supabase)

Files added:
- `supabase/functions/yoco-webhook/index.ts`
- `supabase/config.toml`

Deploy:

```bash
supabase functions deploy yoco-webhook --project-ref <project-ref>
```

Set Edge Function secrets:

```bash
supabase secrets set YOCO_WEBHOOK_SECRET=<your-webhook-secret> --project-ref <project-ref>
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically in hosted Edge Functions.

## 4) Yoco dashboard configuration

Set your webhook URL in Yoco to:

```text
https://<project-ref>.supabase.co/functions/v1/yoco-webhook
```

Then set your Yoco API key in Next.js as `YOCO_SECRET_KEY`.

## 5) End-to-end flow

1. User creates post + selects boost plan.
2. Next API (`/api/boosts/checkout`) creates pending payment row and Yoco checkout.
3. Yoco sends webhook event to Supabase Edge Function.
4. Edge Function verifies signature (if secret configured) and calls RPC.
5. RPC updates `boost_payments` and inserts/extends `boosts`.
