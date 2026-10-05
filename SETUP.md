# DigitalTraff — Setup Checklist

1. Open Supabase SQL Editor, paste the entire `supabase/schema.sql`, click Run.
2. Go to Edge Functions, create `create-payment` — paste `supabase/functions/create-payment/index.ts`.
3. Create `nowpayments-ipn` — paste `supabase/functions/nowpayments-ipn/index.ts`.
4. Add Edge Function secrets: `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`.
5. For `nowpayments-ipn`: turn OFF JWT verification (Settings → verify_jwt = false).
6. Authentication → Providers → Email → turn OFF "Confirm email".
7. Sign up, then in SQL Editor run:
   `UPDATE profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');`
8. Make sure `.env` has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
9. Done — the app is live.
