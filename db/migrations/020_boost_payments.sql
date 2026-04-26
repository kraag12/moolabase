CREATE TABLE IF NOT EXISTS public.boost_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('job', 'service')),
  listing_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending',
  yoco_checkout_id TEXT,
  yoco_payment_id TEXT,
  checkout_url TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB,
  raw_event JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boost_payments_user ON public.boost_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_payments_listing ON public.boost_payments(listing_type, listing_id);
CREATE INDEX IF NOT EXISTS idx_boost_payments_status ON public.boost_payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_boost_payments_checkout ON public.boost_payments(yoco_checkout_id) WHERE yoco_checkout_id IS NOT NULL;
