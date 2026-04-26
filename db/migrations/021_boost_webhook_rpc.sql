CREATE OR REPLACE FUNCTION public.process_boost_payment_webhook(
  p_payment_id UUID DEFAULT NULL,
  p_checkout_id TEXT DEFAULT NULL,
  p_yoco_payment_id TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_raw_event JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.boost_payments%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_status TEXT := LOWER(COALESCE(p_status, 'pending'));
  v_duration_hours INTEGER := 0;
  v_boost_id UUID;
  v_boost_ends_at TIMESTAMPTZ;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
BEGIN
  SELECT *
  INTO v_payment
  FROM public.boost_payments bp
  WHERE (
    p_payment_id IS NOT NULL
    AND bp.id = p_payment_id
  ) OR (
    p_checkout_id IS NOT NULL
    AND bp.yoco_checkout_id = p_checkout_id
  ) OR (
    p_yoco_payment_id IS NOT NULL
    AND bp.yoco_payment_id = p_yoco_payment_id
  )
  ORDER BY bp.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_payment.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'payment_not_found');
  END IF;

  UPDATE public.boost_payments
  SET
    raw_event = COALESCE(p_raw_event, '{}'::jsonb),
    yoco_checkout_id = COALESCE(NULLIF(p_checkout_id, ''), yoco_checkout_id),
    yoco_payment_id = COALESCE(NULLIF(p_yoco_payment_id, ''), yoco_payment_id),
    updated_at = v_now
  WHERE id = v_payment.id;

  IF v_status IN ('paid', 'succeeded', 'successful', 'completed', 'success') THEN
    IF COALESCE(v_payment.status, '') <> 'paid' THEN
      v_duration_hours := CASE v_payment.plan
        WHEN '24h' THEN 24
        WHEN '3d' THEN 72
        WHEN '7d' THEN 168
        ELSE 0
      END;

      IF v_duration_hours <= 0 THEN
        UPDATE public.boost_payments
        SET status = 'failed',
            updated_at = v_now,
            metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('activation_error', 'invalid_plan')
        WHERE id = v_payment.id;

        RETURN jsonb_build_object('ok', false, 'error', 'invalid_plan');
      END IF;

      SELECT b.id, b.ends_at
      INTO v_boost_id, v_boost_ends_at
      FROM public.boosts b
      WHERE b.listing_type = v_payment.listing_type
        AND b.listing_id = v_payment.listing_id
        AND b.ends_at >= v_now
      ORDER BY b.ends_at DESC
      LIMIT 1
      FOR UPDATE;

      IF v_boost_id IS NOT NULL THEN
        UPDATE public.boosts
        SET
          ends_at = GREATEST(v_boost_ends_at, v_now) + (v_duration_hours || ' hours')::INTERVAL,
          plan = v_payment.plan,
          price_cents = v_payment.amount_cents
        WHERE id = v_boost_id;
      ELSE
        v_starts_at := v_now;
        v_ends_at := v_now + (v_duration_hours || ' hours')::INTERVAL;

        INSERT INTO public.boosts (
          listing_type,
          listing_id,
          user_id,
          plan,
          price_cents,
          starts_at,
          ends_at
        ) VALUES (
          v_payment.listing_type,
          v_payment.listing_id,
          v_payment.user_id,
          v_payment.plan,
          v_payment.amount_cents,
          v_starts_at,
          v_ends_at
        );
      END IF;

      UPDATE public.boost_payments
      SET
        status = 'paid',
        paid_at = v_now,
        updated_at = v_now
      WHERE id = v_payment.id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'activated', true, 'payment_id', v_payment.id);
  END IF;

  UPDATE public.boost_payments
  SET
    status = CASE
      WHEN v_status IN ('cancelled', 'canceled') THEN 'cancelled'
      WHEN v_status IN ('failed', 'declined') THEN 'failed'
      ELSE 'pending'
    END,
    updated_at = v_now
  WHERE id = v_payment.id
    AND COALESCE(status, 'pending') = 'pending';

  RETURN jsonb_build_object('ok', true, 'activated', false, 'payment_id', v_payment.id);
END;
$$;

REVOKE ALL ON FUNCTION public.process_boost_payment_webhook(UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_boost_payment_webhook(UUID, TEXT, TEXT, TEXT, JSONB) TO service_role;
