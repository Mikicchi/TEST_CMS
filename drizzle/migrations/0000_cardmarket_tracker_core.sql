-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- USER SETTINGS
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_interval_minutes INTEGER NOT NULL DEFAULT 60,
  requests_per_minute INTEGER NOT NULL DEFAULT 6,
  jitter_seconds INTEGER NOT NULL DEFAULT 8,
  max_retries_per_card INTEGER NOT NULL DEFAULT 3,
  use_proxies BOOLEAN NOT NULL DEFAULT true,
  fallback_scraper BOOLEAN NOT NULL DEFAULT true,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  notify_telegram BOOLEAN NOT NULL DEFAULT false,
  telegram_chat_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PROXIES (shared pool, managed server-side)
CREATE TABLE public.proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  port INTEGER NOT NULL,
  country_code TEXT,
  country_name TEXT,
  anonymity TEXT,
  supports_https BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'unknown',
  latency_ms INTEGER,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  banned_until TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'free-proxy-list.net',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ip, port)
);
GRANT SELECT ON public.proxies TO authenticated;
GRANT ALL ON public.proxies TO service_role;
ALTER TABLE public.proxies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proxies readable" ON public.proxies FOR SELECT TO authenticated USING (true);

-- TRACKED CARDS
CREATE TABLE public.tracked_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game TEXT NOT NULL DEFAULT 'Magic',
  name TEXT NOT NULL,
  expansion TEXT,
  card_url TEXT NOT NULL,
  condition TEXT,
  language TEXT,
  target_price NUMERIC(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, card_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_cards TO authenticated;
GRANT ALL ON public.tracked_cards TO service_role;
ALTER TABLE public.tracked_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards" ON public.tracked_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_tracked_cards_user ON public.tracked_cards(user_id);

-- PRICE SNAPSHOTS
CREATE TABLE public.price_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.tracked_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_from NUMERIC(10,2),
  price_avg NUMERIC(10,2),
  price_trend NUMERIC(10,2),
  available_items INTEGER,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.price_snapshots TO authenticated;
GRANT ALL ON public.price_snapshots TO service_role;
ALTER TABLE public.price_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own snapshots" ON public.price_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_snapshots_card ON public.price_snapshots(card_id, captured_at DESC);

-- SCRAPE LOGS
CREATE TABLE public.scrape_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.tracked_cards(id) ON DELETE SET NULL,
  target_url TEXT,
  method TEXT NOT NULL DEFAULT 'proxy',
  proxy_label TEXT,
  status TEXT NOT NULL,
  http_status INTEGER,
  duration_ms INTEGER,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.scrape_logs TO authenticated;
GRANT ALL ON public.scrape_logs TO service_role;
ALTER TABLE public.scrape_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs" ON public.scrape_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_logs_user ON public.scrape_logs(user_id, created_at DESC);

-- ALERTS
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.tracked_cards(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL DEFAULT 'below_price',
  threshold NUMERIC(10,2) NOT NULL,
  window_days INTEGER NOT NULL DEFAULT 7,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alerts" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  card_id UUID REFERENCES public.tracked_cards(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);