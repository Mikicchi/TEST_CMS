import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* --------------------------- card details ---------------------------- */

const updateSchema = z.object({
  id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999).optional(),
  purchase_price: z.number().nullable().optional(),
  target_price: z.number().nullable().optional(),
  condition: z.string().max(10).nullable().optional(),
  language: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const updateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) fields[key] = value;
    }
    const { error } = await context.supabase
      .from("tracked_cards")
      .update(fields)
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- CSV --------------------------------- */

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        card_url: z.string().url(),
        game: z.string().max(60).optional(),
        name: z.string().max(200).optional(),
        quantity: z.number().int().min(1).max(999).optional(),
        purchase_price: z.number().nullable().optional(),
        condition: z.string().max(10).nullable().optional(),
        language: z.string().max(20).nullable().optional(),
      }),
    )
    .min(1)
    .max(300),
});

export const importCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: app } = await context.supabase.from("app_settings").select("*").maybeSingle();
    const { count } = await context.supabase
      .from("tracked_cards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);

    const limit = app?.max_cards_per_user ?? 200;
    const room = Math.max(0, limit - (count ?? 0));
    const valid = data.rows
      .filter((r) => r.card_url.includes("cardmarket.com"))
      .slice(0, room);

    if (valid.length === 0) {
      return { imported: 0, skipped: data.rows.length, limit };
    }

    const payload = valid.map((r) => ({
      user_id: context.userId,
      card_url: r.card_url,
      game: r.game?.trim() || "Magic",
      name:
        r.name?.trim() ||
        decodeURIComponent(r.card_url.split("?")[0]!.split("/").pop() ?? "")
          .replace(/-/g, " ")
          .trim() ||
        "Carta sin nombre",
      quantity: r.quantity ?? 1,
      purchase_price: r.purchase_price ?? null,
      condition: r.condition ?? null,
      language: r.language ?? null,
    }));

    const { error, data: inserted } = await context.supabase
      .from("tracked_cards")
      .upsert(payload, { onConflict: "user_id,card_url", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);

    return {
      imported: inserted?.length ?? 0,
      skipped: data.rows.length - (inserted?.length ?? 0),
      limit,
    };
  });

/* -------------------------- collection value -------------------------- */

export const getCollection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cards } = await context.supabase
      .from("tracked_cards")
      .select("*")
      .eq("user_id", context.userId);
    const { data: snaps } = await context.supabase
      .from("price_snapshots")
      .select("card_id, price_from, price_avg, captured_at")
      .eq("user_id", context.userId)
      .order("captured_at", { ascending: true })
      .limit(8000);

    const byCard = new Map<string, { from: number[]; avg: number[]; last: number | null }>();
    for (const s of snaps ?? []) {
      const entry = byCard.get(s.card_id) ?? { from: [], avg: [], last: null };
      if (s.price_from !== null) {
        entry.from.push(Number(s.price_from));
        entry.last = Number(s.price_from);
      }
      if (s.price_avg !== null) entry.avg.push(Number(s.price_avg));
      byCard.set(s.card_id, entry);
    }

    const items = (cards ?? []).map((card) => {
      const entry = byCard.get(card.id) ?? { from: [], avg: [], last: null };
      const history = entry.from;
      const price = entry.last;
      const mean = history.length
        ? history.reduce((a, b) => a + b, 0) / history.length
        : null;
      const min = history.length ? Math.min(...history) : null;
      // Precio objetivo: por debajo de la media histórica, nunca bajo el mínimo visto
      const suggested =
        mean !== null ? Math.max(min ?? mean * 0.8, Number((mean * 0.88).toFixed(2))) : null;
      const isDeal = price !== null && mean !== null && price <= mean * 0.85;
      const qty = card.quantity ?? 1;
      const value = price !== null ? price * qty : null;
      const cost = card.purchase_price !== null ? Number(card.purchase_price) * qty : null;
      const pnl = value !== null && cost !== null ? value - cost : null;
      return {
        id: card.id,
        name: card.name,
        game: card.game,
        expansion: card.expansion,
        card_url: card.card_url,
        condition: card.condition,
        language: card.language,
        quantity: qty,
        purchase_price: card.purchase_price !== null ? Number(card.purchase_price) : null,
        target_price: card.target_price !== null ? Number(card.target_price) : null,
        price,
        mean,
        min,
        suggested,
        isDeal,
        value,
        cost,
        pnl,
      };
    });

    const totals = items.reduce(
      (acc, it) => {
        acc.value += it.value ?? 0;
        acc.cost += it.cost ?? 0;
        return acc;
      },
      { value: 0, cost: 0 },
    );

    return {
      items,
      totals: {
        ...totals,
        pnl: totals.value - totals.cost,
        pnlPct: totals.cost > 0 ? ((totals.value - totals.cost) / totals.cost) * 100 : null,
        cards: items.length,
        units: items.reduce((a, b) => a + b.quantity, 0),
        deals: items.filter((i) => i.isDeal).length,
      },
    };
  });

/* --------------------------- weekly digest ---------------------------- */

export const buildWeeklyDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: cards } = await context.supabase
      .from("tracked_cards")
      .select("id, name, game, expansion")
      .eq("user_id", context.userId);
    const { data: snaps } = await context.supabase
      .from("price_snapshots")
      .select("card_id, price_from, captured_at")
      .eq("user_id", context.userId)
      .gte("captured_at", start.toISOString())
      .order("captured_at", { ascending: true })
      .limit(8000);

    const moves: { name: string; from: number; to: number; pct: number }[] = [];
    for (const card of cards ?? []) {
      const points = (snaps ?? []).filter(
        (s) => s.card_id === card.id && s.price_from !== null,
      );
      if (points.length < 2) continue;
      const first = Number(points[0]!.price_from);
      const last = Number(points.at(-1)!.price_from);
      if (first <= 0) continue;
      moves.push({ name: card.name, from: first, to: last, pct: ((last - first) / first) * 100 });
    }
    moves.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    const summary = {
      cards: (cards ?? []).length,
      checks: (snaps ?? []).length,
      risers: moves.filter((m) => m.pct > 1.5).slice(0, 5),
      fallers: moves.filter((m) => m.pct < -1.5).slice(0, 5),
    };

    const { data: digest, error } = await context.supabase
      .from("weekly_digests")
      .insert({
        user_id: context.userId,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        summary,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("notifications").insert({
      user_id: context.userId,
      title: "Resumen semanal listo",
      body: `${summary.risers.length} cartas subiendo y ${summary.fallers.length} bajando esta semana.`,
    });

    return digest;
  });

export const listDigests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("weekly_digests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(10);
    return data ?? [];
  });

/* ------------------------------ scanner ------------------------------- */

export const scanCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ image: z.string().min(100).max(8_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: app } = await context.supabase.from("app_settings").select("*").maybeSingle();
    if (app && !app.allow_scanner)
      throw new Error("El escáner está desactivado por el administrador");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la configuración del reconocimiento de imágenes");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: 'Identifica esta carta coleccionable (Magic: The Gathering o Riftbound). Responde SOLO con JSON: {"name":"","game":"Magic|Riftbound","expansion":"","confidence":0-1}. El nombre, en inglés, tal cual aparece impreso.',
              },
              { type: "input_image", image_url: data.image },
            ],
          },
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Demasiadas peticiones, prueba en unos segundos");
      if (res.status === 402)
        throw new Error("Se han agotado los créditos de reconocimiento de imágenes");
      throw new Error(`No se pudo reconocer la carta (${res.status}): ${body.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload) as { type?: string; delta?: string };
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
            text += evt.delta;
          }
        } catch {
          /* ignora trozos incompletos */
        }
      }
    }

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No he podido leer la carta, prueba con mejor luz");
    const parsed = JSON.parse(match[0]) as {
      name?: string;
      game?: string;
      expansion?: string;
      confidence?: number;
    };
    if (!parsed.name) throw new Error("No he reconocido ninguna carta en la foto");

    const game = parsed.game?.toLowerCase().includes("rift") ? "Riftbound" : "Magic";
    const searchUrl = `https://www.cardmarket.com/en/${game}/Products/Search?searchString=${encodeURIComponent(
      parsed.name,
    )}`;

    return {
      name: parsed.name,
      game,
      expansion: parsed.expansion || null,
      confidence: parsed.confidence ?? null,
      searchUrl,
    };
  });
