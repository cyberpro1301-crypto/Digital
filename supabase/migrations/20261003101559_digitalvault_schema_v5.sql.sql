/*
# DigitalVault Schema v5 — User profiles, product details, direct purchases, admin balance management

## Summary
1. profiles: add `nickname` and `telegram` columns
2. products: add `details_en` and `details_ru` columns for per-offer detailed descriptions
3. transactions: add `purchase_type`, `product_id`, `qty` columns to support direct crypto purchases
4. profiles UPDATE policy + column-level GRANT so users can edit their own nickname/telegram (NOT role/balance)
5. handle_new_user trigger updated to capture nickname from signup metadata
6. admin_adjust_balance() SECURITY DEFINER function for admin to add/subtract user balance
7. direct_purchase_fulfill() SECURITY DEFINER function to fulfill direct crypto purchases
8. products_public view dropped and recreated to include details columns
9. RLS policies for new columns and admin functions
*/

-- 1. Add nickname and telegram to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS telegram text;

-- 2. Add details columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS details_en text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS details_ru text NOT NULL DEFAULT '';

-- 3. Add direct purchase columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'topup' CHECK (purchase_type IN ('topup','direct')),
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS qty int;

-- 4. Update handle_new_user to capture nickname from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_uid text; attempts int := 0; _nickname text;
BEGIN
  _nickname := NEW.raw_user_meta_data->>'nickname';
  LOOP
    new_uid := 'UID-' || lpad(floor(random() * 100000)::text, 5, '0');
    INSERT INTO public.profiles (id, public_uid, nickname)
    VALUES (NEW.id, new_uid, _nickname)
    ON CONFLICT (id) DO NOTHING;
    EXIT WHEN FOUND;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      new_uid := 'UID-' || substring(NEW.id::text, 1, 5);
      INSERT INTO public.profiles (id, public_uid, nickname)
      VALUES (NEW.id, new_uid, _nickname)
      ON CONFLICT (id) DO NOTHING;
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 5. Column-level GRANT: users can only UPDATE nickname and telegram, NOT role or balance
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (nickname, telegram) ON public.profiles TO authenticated;

-- 6. UPDATE policy on profiles (owner-scoped)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 7. admin_adjust_balance function
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(target_uid uuid, delta numeric(12,2))
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _balance numeric(12,2);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.profiles SET balance = balance + delta
  WHERE id = target_uid RETURNING balance INTO _balance;
  IF _balance IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF _balance < 0 THEN
    RAISE EXCEPTION 'Resulting balance cannot be negative';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric) TO authenticated;

-- 8. direct_purchase_fulfill function
CREATE OR REPLACE FUNCTION public.direct_purchase_fulfill(tx_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _tx public.transactions%ROWTYPE;
  _product public.products%ROWTYPE;
  _qty int;
  _order_id uuid;
  _payloads text[];
  _row public.stock_items;
  _remaining int;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE id = tx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF _tx.credited THEN RETURN jsonb_build_object('already_fulfilled', true); END IF;
  IF _tx.purchase_type <> 'direct' THEN RAISE EXCEPTION 'Not a direct purchase'; END IF;
  IF _tx.status <> 'finished' THEN RAISE EXCEPTION 'Transaction not finished'; END IF;

  _qty := COALESCE(_tx.qty, 1);
  SELECT * INTO _product FROM public.products WHERE id = _tx.product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF NOT _product.is_unlimited THEN
    SELECT count(*)::int INTO _remaining FROM public.stock_items
    WHERE product_id = _product.id AND is_sold = false FOR UPDATE;
    IF _remaining < _qty THEN RAISE EXCEPTION 'Insufficient stock for %', _product.name_en; END IF;
  END IF;

  INSERT INTO public.orders (user_id, total, status)
  VALUES (_tx.user_id, _tx.amount, 'completed')
  RETURNING id INTO _order_id;

  IF _product.is_unlimited THEN
    INSERT INTO public.order_items (order_id, product_id, qty, price, delivered_payload)
    VALUES (_order_id, _product.id, _qty, _product.price, _product.file_path);
  ELSE
    _payloads := ARRAY[]::text[];
    FOR i IN 1.._qty LOOP
      SELECT * INTO _row FROM public.stock_items
      WHERE product_id = _product.id AND is_sold = false
      ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF NOT FOUND THEN RAISE EXCEPTION 'Stock exhausted mid-fulfillment for %', _product.name_en; END IF;
      UPDATE public.stock_items SET is_sold = true WHERE id = _row.id;
      _payloads := array_append(_payloads, _row.payload);
    END LOOP;
    INSERT INTO public.order_items (order_id, product_id, qty, price, delivered_payload)
    VALUES (_order_id, _product.id, _qty, _product.price, array_to_string(_payloads, E'\n'));
  END IF;

  UPDATE public.transactions SET credited = true WHERE id = tx_id;

  RETURN jsonb_build_object('order_id', _order_id, 'total', _tx.amount);
END;
$$;
GRANT EXECUTE ON FUNCTION public.direct_purchase_fulfill(uuid) TO authenticated;

-- 9. Drop and recreate products_public view with details columns
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public
WITH (security_invoker = true) AS
SELECT p.id, p.name_en, p.name_ru, p.description_en, p.description_ru,
       p.details_en, p.details_ru,
       p.category, p.price, p.badge, p.is_unlimited, p.created_at,
       (p.file_path IS NOT NULL) AS has_file,
       CASE WHEN p.is_unlimited THEN 9999
            ELSE COALESCE((SELECT count(*)::int FROM public.stock_items s
                           WHERE s.product_id = p.id AND s.is_sold = false), 0)
       END AS stock
FROM public.products p;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- 10. Re-assert admin SELECT on profiles
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());
