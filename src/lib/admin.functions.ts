import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const { data: app } = await context.supabase.from("app_settings").select("*").maybeSingle();
    return {
      userId: context.userId,
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      app,
    };
  });

const appSettingsSchema = z.object({
  debug_mode: z.boolean(),
  allow_direct_fetch: z.boolean(),
  allow_fallback_scraper: z.boolean(),
  scraping_enabled: z.boolean(),
  allow_scanner: z.boolean(),
  max_cards_per_user: z.number().int().min(1).max(5000),
  min_refresh_interval_minutes: z.number().int().min(5).max(1440),
  max_requests_per_minute: z.number().int().min(1).max(60),
});

export const saveAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => appSettingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Solo un administrador puede cambiar estos ajustes");
    const { error } = await context.supabase
      .from("app_settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acceso restringido");

    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id, email, display_name, created_at")
      .order("created_at", { ascending: true })
      .limit(200);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const { data: cards } = await context.supabase.from("tracked_cards").select("user_id");

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      cardCount: (cards ?? []).filter((c) => c.user_id === p.id).length,
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ userId: z.string().uuid(), admin: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acceso restringido");
    if (data.userId === context.userId && !data.admin) {
      throw new Error("No puedes quitarte a ti mismo el acceso de administrador");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.admin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
    }
    return { ok: true };
  });

export const adminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acceso restringido");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: logs }, { data: proxies }, { data: cards }] = await Promise.all([
      supabaseAdmin.from("scrape_logs").select("status, method").gte("created_at", since),
      supabaseAdmin.from("proxies").select("status"),
      supabaseAdmin.from("tracked_cards").select("id"),
    ]);

    const l = logs ?? [];
    return {
      last24h: {
        total: l.length,
        ok: l.filter((x) => x.status === "ok").length,
        blocked: l.filter((x) => x.status === "blocked").length,
        error: l.filter((x) => x.status === "error").length,
        direct: l.filter((x) => x.method === "direct").length,
        proxy: l.filter((x) => x.method === "proxy").length,
        fallback: l.filter((x) => x.method === "fallback").length,
      },
      proxies: {
        total: (proxies ?? []).length,
        alive: (proxies ?? []).filter((p) => p.status === "alive").length,
        banned: (proxies ?? []).filter((p) => p.status === "banned").length,
        dead: (proxies ?? []).filter((p) => p.status === "dead").length,
      },
      cards: (cards ?? []).length,
    };
  });
