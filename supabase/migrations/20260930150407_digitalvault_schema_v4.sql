/*
# DigitalVault — Full Schema (final)

Creates the complete data model for a digital-goods store: profiles, products,
stock_items, orders, order_items, transactions, a public products view, a private
storage bucket for product files, and all RLS policies.

1. Tables: profiles, products, stock_items, orders, order_items, transactions
2. Views: products_public
3. Functions: is_admin(), handle_new_user(), purchase(items), credit_balance(tx_id)
4. Security: RLS on all tables, public read on products, owner-scoped user data,
   admin-scoped management, private storage bucket with buyer-gated reads
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  public_uid  text UNIQUE NOT NULL,
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  balance     numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. is_admin() helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- 3. profiles RLS
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

-- 4. Trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE new_uid text; attempts int := 0;
BEGIN
  LOOP
    new_uid := 'UID-' || lpad(floor(random() * 100000)::text, 5, '0');
    INSERT INTO public.profiles (id, public_uid) VALUES (NEW.id, new_uid) ON CONFLICT (id) DO NOTHING;
    EXIT WHEN FOUND;
    attempts := attempts + 1;
    IF attempts > 10 THEN
      new_uid := 'UID-' || substring(NEW.id::text, 1, 5);
      INSERT INTO public.profiles (id, public_uid) VALUES (NEW.id, new_uid) ON CONFLICT (id) DO NOTHING;
      EXIT;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. products
CREATE TABLE IF NOT EXISTS public.products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en         text NOT NULL,
  name_ru         text NOT NULL,
  description_en  text NOT NULL DEFAULT '',
  description_ru  text NOT NULL DEFAULT '',
  category        text NOT NULL CHECK (category IN ('bundles','accounts','proxies','cards','tools')),
  price           numeric(12,2) NOT NULL CHECK (price >= 0),
  badge           text CHECK (badge IS NULL OR badge IN ('HOT','BEST VALUE')),
  file_path       text,
  is_unlimited    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public" ON public.products
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "products_insert_admin" ON public.products;
CREATE POLICY "products_insert_admin" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin" ON public.products
  FOR DELETE TO authenticated USING (public.is_admin());

-- 6. stock_items
CREATE TABLE IF NOT EXISTS public.stock_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payload     text NOT NULL,
  is_sold     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_items_product ON public.stock_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_unsold ON public.stock_items(product_id) WHERE is_sold = false;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_items_select_admin" ON public.stock_items;
CREATE POLICY "stock_items_select_admin" ON public.stock_items
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "stock_items_insert_admin" ON public.stock_items;
CREATE POLICY "stock_items_insert_admin" ON public.stock_items
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "stock_items_update_admin" ON public.stock_items;
CREATE POLICY "stock_items_update_admin" ON public.stock_items
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "stock_items_delete_admin" ON public.stock_items;
CREATE POLICY "stock_items_delete_admin" ON public.stock_items
  FOR DELETE TO authenticated USING (public.is_admin());

-- 7. products_public view
CREATE OR REPLACE VIEW public.products_public
WITH (security_invoker = true) AS
SELECT p.id, p.name_en, p.name_ru, p.description_en, p.description_ru,
       p.category, p.price, p.badge, p.is_unlimited, p.created_at,
       (p.file_path IS NOT NULL) AS has_file,
       CASE WHEN p.is_unlimited THEN 9999
            ELSE COALESCE((SELECT count(*)::int FROM public.stock_items s
                           WHERE s.product_id = p.id AND s.is_sold = false), 0)
       END AS stock
FROM public.products p;
GRANT SELECT ON public.products_public TO anon, authenticated;

-- 8. orders
CREATE TABLE IF NOT EXISTS public.orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total       numeric(12,2) NOT NULL,
  status      text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders_select_admin" ON public.orders;
CREATE POLICY "orders_select_admin" ON public.orders
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
CREATE POLICY "orders_update_admin" ON public.orders
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9. order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty               int NOT NULL CHECK (qty > 0),
  price             numeric(12,2) NOT NULL,
  delivered_payload text
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own" ON public.order_items;
CREATE POLICY "order_items_select_own" ON public.order_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "order_items_select_admin" ON public.order_items;
CREATE POLICY "order_items_select_admin" ON public.order_items
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "order_items_insert_own" ON public.order_items;
CREATE POLICY "order_items_insert_own" ON public.order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
  );

-- 10. transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        numeric(12,2) NOT NULL,
  currency      text NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','finished','partially_paid','failed','expired')),
  pay_address   text,
  pay_amount    numeric(18,8),
  np_payment_id text,
  credited      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_np ON public.transactions(np_payment_id);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tx_select_own" ON public.transactions;
CREATE POLICY "tx_select_own" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "tx_select_admin" ON public.transactions;
CREATE POLICY "tx_select_admin" ON public.transactions
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "tx_insert_own" ON public.transactions;
CREATE POLICY "tx_insert_own" ON public.transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "tx_update_own" ON public.transactions;
CREATE POLICY "tx_update_own" ON public.transactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 11. purchase() RPC
CREATE OR REPLACE FUNCTION public.purchase(items jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _item jsonb; _product public.products; _qty int;
  _total numeric(12,2) := 0; _order_id uuid;
  _payloads text[]; _row public.stock_items;
  _remaining int; _credit text;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_array_length(items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  FOR _item IN SELECT jsonb_array_elements(items) LOOP
    _qty := (_item->>'qty')::int;
    IF _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF NOT _product.is_unlimited THEN
      SELECT count(*)::int INTO _remaining FROM public.stock_items
      WHERE product_id = _product.id AND is_sold = false FOR UPDATE;
      IF _remaining < _qty THEN RAISE EXCEPTION 'Insufficient stock for %', _product.name_en; END IF;
    END IF;
    _total := _total + (_product.price * _qty);
  END LOOP;

  UPDATE public.profiles SET balance = balance - _total
  WHERE id = _user_id AND balance >= _total RETURNING balance::text INTO _credit;
  IF _credit IS NULL THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  INSERT INTO public.orders (user_id, total, status)
  VALUES (_user_id, _total, 'completed') RETURNING id INTO _order_id;

  FOR _item IN SELECT jsonb_array_elements(items) LOOP
    _qty := (_item->>'qty')::int;
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid;
    IF _product.is_unlimited THEN
      INSERT INTO public.order_items (order_id, product_id, qty, price, delivered_payload)
      VALUES (_order_id, _product.id, _qty, _product.price, _product.file_path);
    ELSE
      _payloads := ARRAY[]::text[];
      FOR i IN 1.._qty LOOP
        SELECT * INTO _row FROM public.stock_items
        WHERE product_id = _product.id AND is_sold = false
        ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED;
        IF NOT FOUND THEN RAISE EXCEPTION 'Stock exhausted mid-purchase for %', _product.name_en; END IF;
        UPDATE public.stock_items SET is_sold = true WHERE id = _row.id;
        _payloads := array_append(_payloads, _row.payload);
      END LOOP;
      INSERT INTO public.order_items (order_id, product_id, qty, price, delivered_payload)
      VALUES (_order_id, _product.id, _qty, _product.price, array_to_string(_payloads, E'\n'));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('order_id', _order_id, 'total', _total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.purchase(jsonb) TO authenticated;

-- 12. credit_balance() RPC
CREATE OR REPLACE FUNCTION public.credit_balance(tx_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _tx public.transactions;
BEGIN
  SELECT * INTO _tx FROM public.transactions WHERE id = tx_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF _tx.credited THEN RETURN; END IF;
  UPDATE public.profiles SET balance = balance + _tx.amount WHERE id = _tx.user_id;
  UPDATE public.transactions SET credited = true, status = 'finished' WHERE id = tx_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.credit_balance(uuid) TO authenticated;

-- 13. Storage bucket + policies
INSERT INTO storage.buckets (id, name, public) VALUES ('product-files', 'product-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_files_admin_write" ON storage.objects;
CREATE POLICY "product_files_admin_write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-files' AND public.is_admin());
DROP POLICY IF EXISTS "product_files_admin_update" ON storage.objects;
CREATE POLICY "product_files_admin_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-files' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-files' AND public.is_admin());
DROP POLICY IF EXISTS "product_files_admin_delete" ON storage.objects;
CREATE POLICY "product_files_admin_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-files' AND public.is_admin());
DROP POLICY IF EXISTS "product_files_buyer_read" ON storage.objects;
CREATE POLICY "product_files_buyer_read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'product-files' AND EXISTS (
      SELECT 1 FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.products p ON p.id = oi.product_id
      WHERE o.user_id = auth.uid() AND p.file_path = name
    )
  );

-- 14. Seed 12 products
INSERT INTO public.products (name_en, name_ru, description_en, description_ru, category, price, badge, is_unlimited)
VALUES
  ('Starter Gambling Pack', 'Стартовый Gambling Pack',
   'A curated bundle of starter accounts and tools for iGaming campaigns. Perfect for testing the waters.',
   'Подобранный набор стартовых аккаунтов и инструментов для iGaming-кампаний. Идеально для начала.',
   'bundles', 90.00, NULL, false),
  ('Pro Gambling Bundle', 'Pro Gambling Bundle',
   'Advanced bundle with premium accounts, cloaking tools, and proxy setup guides for scaling iGaming offers.',
   'Продвинутый набор с премиум-аккаунтами, инструментами клоакинга и гайдами по прокси для масштабирования iGaming-офферов.',
   'bundles', 250.00, 'HOT', false),
  ('Meta Farmed Accounts (5 pcs)', 'Meta Farmed Accounts (5 шт)',
   'Five carefully farmed Meta (Facebook) accounts with warm-up history. Ready for immediate ad campaigns.',
   'Пять тщательно отфармленных аккаунтов Meta (Facebook) с историей прогрева. Готовы к запуску рекламы.',
   'accounts', 45.00, NULL, false),
  ('TikTok Agency Accounts', 'TikTok Agency Accounts',
   'Verified TikTok agency accounts with elevated spending limits. Ideal for running high-volume ad campaigns.',
   'Верифицированные агентские аккаунты TikTok с повышенными лимитами расходов. Идеально для масштабных рекламных кампаний.',
   'accounts', 120.00, NULL, false),
  ('Google Ads Threshold Accounts', 'Google Ads Threshold Accounts',
   'Google Ads accounts pre-configured with spending thresholds. Reach your audience without delays.',
   'Аккаунты Google Ads, предварительно настроенные с порогами расходов. Охватите аудиторию без задержек.',
   'accounts', 80.00, NULL, false),
  ('Mobile Proxies US (1 Month)', 'Мобильные прокси US (1 месяц)',
   'Premium US mobile proxies with 4G/LTE rotation. One month of unlimited traffic for reliable ad accounts.',
   'Премиум мобильные прокси США с 4G/LTE ротацией. Месяц безлимитного трафика для надёжных рекламных аккаунтов.',
   'proxies', 60.00, NULL, false),
  ('Residential Proxies (10GB)', 'Резидентные прокси (10ГБ)',
   'High-quality residential proxies with 10GB of traffic. Geo-targeting and IP rotation included.',
   'Высококачественные резидентные прокси с 10ГБ трафика. Гео-таргетинг и ротация IP включены.',
   'proxies', 35.00, NULL, false),
  ('Virtual Cards (Pack of 5)', 'Виртуальные карты (набор из 5)',
   'Five prepaid virtual cards for online advertising payments. Multi-currency support and instant top-up.',
   'Пять предоплаченных виртуальных карт для оплаты онлайн-рекламы. Поддержка нескольких валют и мгновенное пополнение.',
   'cards', 25.00, NULL, false),
  ('Telegram Invite Bot Setup', 'Настройка Telegram Invite Bot',
   'Complete setup of a Telegram invite bot for automated group management. Includes configuration guide.',
   'Полная настройка Telegram-бота для приглашений и автоматического управления группами. Включает руководство по конфигурации.',
   'tools', 150.00, NULL, false),
  ('Elite iGaming Scale Pack', 'Elite iGaming Scale Pack',
   'The ultimate bundle for scaling iGaming: premium accounts, residential proxies, cloaking setup, and virtual cards.',
   'Максимальный набор для масштабирования iGaming: премиум-аккаунты, резидентные прокси, настройка клоакинга и виртуальные карты.',
   'bundles', 500.00, 'BEST VALUE', false),
  ('Cloaking & Landing Page Setup', 'Настройка клоакинга и лендингов',
   'Professional cloaking configuration and custom landing page setup. Bypass moderation filters with confidence.',
   'Профессиональная настройка клоакинга и создание кастомных лендингов. Обходите фильтры модерации уверенно.',
   'tools', 110.00, NULL, false),
  ('Telegram Farmed Accounts (10 pcs)', 'Telegram Farmed Accounts (10 шт)',
   'Ten warm Telegram accounts with history. Suitable for mass inviting, messaging, and channel management.',
   'Десять прогретых Telegram-аккаунтов с историей. Подходят для массовых приглашений, рассылок и управления каналами.',
   'accounts', 20.00, 'HOT', false)
ON CONFLICT DO NOTHING;
