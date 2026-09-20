import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ------------------------------ settings ------------------------------ */

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (data) return data;
    const { data: created, error } = await context.supabase
      .from("user_settings")
      .insert({ user_id: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });

const settingsSchema = z.object({
  refresh_interval_minutes: z.number().int().min(5).max(1440),
  requests_per_minute: z.number().int().min(1).max(60),
  jitter_seconds: z.number().int().min(0).max(120),
  max_retries_per_card: z.number().int().min(1).max(10),
  use_proxies: z.boolean(),
  fallback_scraper: z.boolean(),
  notify_in_app: z.boolean(),
  notify_email: z.boolean(),
  notify_telegram: z.boolean(),
  telegram_chat_id: z.string().max(64).nullable(),
});

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_settings")
      .upsert({ ...data, user_id: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- proxies ------------------------------ */

export const listProxies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("proxies")
      .select("*")
      .order("status", { ascending: true })
      .order("latency_ms", { ascending: true, nullsFirst: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const refreshProxies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { fetchFreeProxyList } = await import("./scraping.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await fetchFreeProxyList();
    if (rows.length === 0) return { imported: 0 };
    const payload = rows.map((r) => ({
      ip: r.ip,
      port: r.port,
      country_code: r.country_code,
      country_name: r.country_name,
      anonymity: r.anonymity,
      supports_https: r.supports_https,
      source: "free-proxy-list.net",
    }));
    const { error } = await supabaseAdmin
      .from("proxies")
      .upsert(payload, { onConflict: "ip,port", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
    return { imported: payload.length };
  });

export const testProxies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().min(1).max(40) }).parse(input))
  .handler(async ({ data }) => {
    const { fetchThroughProxy } = await import("./scraping.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: candidates } = await supabaseAdmin
      .from("proxies")
      .select("id, ip, port")
      .in("status", ["unknown", "dead", "slow", "alive"])
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(data.limit);

    const list = candidates ?? [];
    const results = await Promise.all(
      list.map(async (p) => {
        const attempt = await fetchThroughProxy("http://example.com/", p, 8000);
        const status = attempt.ok ? (attempt.durationMs > 5000 ? "slow" : "alive") : "dead";
        await supabaseAdmin
          .from("proxies")
          .update({
            status,
            latency_ms: attempt.durationMs,
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", p.id);
        return status;
      }),
    );
    return {
      tested: results.length,
      alive: results.filter((r) => r === "alive").length,
      slow: results.filter((r) => r === "slow").length,
      dead: results.filter((r) => r === "dead").length,
    };
  });

/* -------------------------------- cards ------------------------------- */

export const listCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cards, error } = await context.supabase
      .from("tracked_cards")
      .select("*")
      .eq("user_id", context.userId)
      .eq("is_tracked", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: snaps } = await context.supabase
      .from("price_snapshots")
      .select("card_id, price_from, price_avg, price_trend, available_items, captured_at")
      .eq("user_id", context.userId)
      .order("captured_at", { ascending: true })
      .limit(5000);

    const history = new Map<string, NonNullable<typeof snaps>>();
    for (const s of snaps ?? []) {
      const arr = history.get(s.card_id) ?? [];
      arr.push(s);
      history.set(s.card_id, arr);
    }

    return (cards ?? []).map((card) => {
      const points = history.get(card.id) ?? [];
      const latest = points.at(-1) ?? null;
      const previous = points.length > 1 ? points[0]! : null;
      const current = latest?.price_from ?? null;
      const before = previous?.price_from ?? null;
      const changePct =
        current !== null && before !== null && Number(before) > 0
          ? ((Number(current) - Number(before)) / Number(before)) * 100
          : null;
      const direction =
        changePct === null ? "flat" : changePct > 1.5 ? "up" : changePct < -1.5 ? "down" : "flat";
      return { ...card, latest, changePct, direction, points };
    });
  });

export const deleteCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tracked_cards")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const addCardSchema = z.object({
  card_url: z.string().url().refine((u) => u.includes("cardmarket.com"), {
    message: "La dirección debe ser de cardmarket.com",
  }),
  game: z.string().min(1).max(60),
  name: z.string().max(200).optional(),
  target_price: z.number().nullable().optional(),
  in_collection: z.boolean().optional(),
  is_tracked: z.boolean().optional(),
});

export const addCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addCardSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: app } = await context.supabase.from("app_settings").select("*").maybeSingle();
    const { count } = await context.supabase
      .from("tracked_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    const limit = app?.max_cards_per_user ?? 200;
    if ((count ?? 0) >= limit) {
      throw new Error(`Has alcanzado el máximo de ${limit} cartas permitidas`);
    }

    const fallbackName =
      data.name?.trim() ||
      decodeURIComponent(data.card_url.split("?")[0]!.split("/").pop() ?? "")
        .replace(/-/g, " ")
        .trim() ||
      "Carta sin nombre";

    const { data: card, error } = await context.supabase
      .from("tracked_cards")
      .insert({
        user_id: context.userId,
        card_url: data.card_url,
        game: data.game,
        name: fallbackName,
        target_price: data.target_price ?? null,
        in_collection: data.in_collection ?? false,
        is_tracked: data.is_tracked ?? true,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return card;
  });

/* ------------------------------ scraping ------------------------------ */

type RunResult = {
  cardId: string;
  name: string;
  ok: boolean;
  method: string;
  price: number | null;
  message?: string | undefined;
};

export const runScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ cardId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const {
      fetchThroughProxy,
      fetchDirect,
      fetchViaFirecrawl,
      parseCardmarketProduct,
      sleep,
    } = await import("./scraping.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: settings } = await context.supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { data: app } = await context.supabase.from("app_settings").select("*").maybeSingle();
    if (app && !app.scraping_enabled) {
      throw new Error("El administrador ha pausado la consulta de precios");
    }
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    // El acceso directo (sin proxy) solo se permite a administradores y en modo depuración.
    const allowDirect = Boolean(isAdmin && app?.debug_mode && app?.allow_direct_fetch);

    const maxRpm = app?.max_requests_per_minute ?? 10;
    const rpm = Math.min(settings?.requests_per_minute ?? 6, maxRpm);
    const jitter = settings?.jitter_seconds ?? 8;
    const retries = settings?.max_retries_per_card ?? 3;
    const useProxies = settings?.use_proxies ?? true;
    const useFallback =
      (settings?.fallback_scraper ?? true) && (app?.allow_fallback_scraper ?? true);

    let query = context.supabase
      .from("tracked_cards")
      .select("*")
      .eq("user_id", context.userId)
      .eq("is_active", true);
    if (data.cardId) query = query.eq("id", data.cardId);
    const { data: cards } = await query.limit(25);

    const { data: proxyPool } = await supabaseAdmin
      .from("proxies")
      .select("id, ip, port, status")
      .in("status", ["alive", "slow", "unknown"])
      .order("status", { ascending: true })
      .limit(60);
    const pool = proxyPool ?? [];
    let cursor = 0;

    const results: RunResult[] = [];

    for (const card of cards ?? []) {
      let attempt: Awaited<ReturnType<typeof fetchDirect>> | null = null;
      let method = useProxies ? "proxy" : allowDirect ? "direct" : "fallback";
      let proxyLabel: string | null = null;

      if (useProxies) {
        for (let i = 0; i < retries && cursor < pool.length; i++) {
          const proxy = pool[cursor++]!;
          proxyLabel = `${proxy.ip}:${proxy.port}`;
          method = "proxy";
          attempt = await fetchThroughProxy(card.card_url, proxy);
          if (attempt.ok) break;
          await supabaseAdmin
            .from("proxies")
            .update({
              status: attempt.blocked ? "banned" : "dead",
              failure_count: 0,
              banned_until: attempt.blocked
                ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
                : null,
              last_checked_at: new Date().toISOString(),
            })
            .eq("id", proxy.id);
        }
      }

      if (!attempt?.ok && allowDirect) {
        method = "direct";
        proxyLabel = null;
        attempt = await fetchDirect(card.card_url);
      }

      if (!attempt?.ok && useFallback) {
        method = "fallback";
        attempt = await fetchViaFirecrawl(card.card_url);
      }

      if (!attempt) {
        attempt = {
          ok: false,
          durationMs: 0,
          message: useProxies
            ? "No quedan proxies disponibles"
            : "No hay ningún método de consulta permitido",
        } as Awaited<ReturnType<typeof fetchDirect>>;
      }


      if (attempt.ok && attempt.html) {
        const parsed = parseCardmarketProduct(attempt.html);
        await context.supabase.from("price_snapshots").insert({
          card_id: card.id,
          user_id: context.userId,
          price_from: parsed.priceFrom,
          price_avg: parsed.priceAvg,
          price_trend: parsed.priceTrend,
          available_items: parsed.availableItems,
        });
        await context.supabase
          .from("tracked_cards")
          .update({
            last_scraped_at: new Date().toISOString(),
            last_error: null,
            name: parsed.name ?? card.name,
            expansion: parsed.expansion ?? card.expansion,
          })
          .eq("id", card.id);
        results.push({
          cardId: card.id,
          name: parsed.name ?? card.name,
          ok: true,
          method,
          price: parsed.priceFrom,
        });
      } else {
        await context.supabase
          .from("tracked_cards")
          .update({ last_error: attempt.message ?? "Fallo desconocido" })
          .eq("id", card.id);
        results.push({
          cardId: card.id,
          name: card.name,
          ok: false,
          method,
          price: null,
          message: attempt.message,
        });
      }

      await context.supabase.from("scrape_logs").insert({
        user_id: context.userId,
        card_id: card.id,
        target_url: card.card_url,
        method,
        proxy_label: proxyLabel,
        status: attempt.ok ? "ok" : attempt.blocked ? "blocked" : "error",
        http_status: attempt.httpStatus ?? null,
        duration_ms: attempt.durationMs,
        message: attempt.message ?? null,
      });

      const gap = Math.max(1000, Math.round(60000 / rpm)) + Math.random() * jitter * 1000;
      if ((cards ?? []).length > 1) await sleep(Math.min(gap, 15000));
    }

    return { results };
  });

/* -------------------------------- logs -------------------------------- */

export const listLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scrape_logs")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
