/**
 * Server-only scraping helpers: proxy list retrieval, proxy rotation and
 * Cardmarket page parsing. Never import this from client code.
 */

export type ProxyRow = {
  ip: string;
  port: number;
  country_code: string | null;
  country_name: string | null;
  anonymity: string | null;
  supports_https: boolean;
};

const UA_POOL = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
];

export function randomUserAgent(): string {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)]!;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Downloads and parses the public proxy table from free-proxy-list.net. */
export async function fetchFreeProxyList(): Promise<ProxyRow[]> {
  const res = await fetch("https://free-proxy-list.net/en/", {
    headers: { "user-agent": randomUserAgent(), accept: "text/html" },
  });
  if (!res.ok) throw new Error(`free-proxy-list.net respondió ${res.status}`);
  const html = await res.text();

  const rows: ProxyRow[] = [];
  const rowRe = /<tr>([\s\S]*?)<\/tr>/g;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html)) !== null) {
    const cells = [...match[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) =>
      stripTags(c[1]!),
    );
    if (cells.length < 7) continue;
    const ip = cells[0]!;
    const port = Number(cells[1]);
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || !Number.isFinite(port) || port <= 0) continue;
    rows.push({
      ip,
      port,
      country_code: cells[2] || null,
      country_name: cells[3] || null,
      anonymity: cells[4] || null,
      supports_https: (cells[6] || "").toLowerCase() === "yes",
    });
  }
  return rows;
}

export type FetchAttempt = {
  ok: boolean;
  html?: string;
  httpStatus?: number;
  durationMs: number;
  message?: string;
  blocked?: boolean;
};

const BLOCK_MARKERS = [
  "just a moment",
  "access denied",
  "unusual traffic",
  "captcha",
  "cf-browser-verification",
  "request blocked",
];

function looksBlocked(html: string, status: number): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const head = html.slice(0, 4000).toLowerCase();
  return BLOCK_MARKERS.some((m) => head.includes(m));
}

async function timedFetch(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Attempts to load a URL through an open HTTP forward proxy using absolute-URI
 * form. Many free proxies accept this; those that don't simply fail and get
 * marked as dead so rotation moves on.
 */
export async function fetchThroughProxy(
  targetUrl: string,
  proxy: { ip: string; port: number },
  timeoutMs = 12000,
): Promise<FetchAttempt> {
  const started = Date.now();
  try {
    const res = await timedFetch(
      `http://${proxy.ip}:${proxy.port}/${targetUrl}`,
      {
        headers: {
          "user-agent": randomUserAgent(),
          accept: "text/html,application/xhtml+xml",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      },
      timeoutMs,
    );
    const html = await res.text();
    const durationMs = Date.now() - started;
    if (!res.ok || html.length < 500) {
      return {
        ok: false,
        httpStatus: res.status,
        durationMs,
        blocked: looksBlocked(html, res.status),
        message: `Respuesta no válida del proxy (${res.status})`,
      };
    }
    if (looksBlocked(html, res.status)) {
      return { ok: false, httpStatus: res.status, durationMs, blocked: true, message: "Bloqueo detectado" };
    }
    return { ok: true, html, httpStatus: res.status, durationMs };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Fallo de conexión con el proxy",
    };
  }
}

/** Direct request, no proxy. */
export async function fetchDirect(targetUrl: string, timeoutMs = 15000): Promise<FetchAttempt> {
  const started = Date.now();
  try {
    const res = await timedFetch(
      targetUrl,
      {
        headers: {
          "user-agent": randomUserAgent(),
          accept: "text/html,application/xhtml+xml",
          "accept-language": "es-ES,es;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      },
      timeoutMs,
    );
    const html = await res.text();
    const durationMs = Date.now() - started;
    if (!res.ok || looksBlocked(html, res.status)) {
      return {
        ok: false,
        httpStatus: res.status,
        durationMs,
        blocked: looksBlocked(html, res.status),
        message: `Cardmarket respondió ${res.status}`,
      };
    }
    return { ok: true, html, httpStatus: res.status, durationMs };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Fallo de conexión directa",
    };
  }
}

/** Last-resort retrieval through the Firecrawl connector, when configured. */
export async function fetchViaFirecrawl(targetUrl: string): Promise<FetchAttempt> {
  const started = Date.now();
  const key = process.env["FIRECRAWL_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!key) {
    return { ok: false, durationMs: 0, message: "Servicio de respaldo no configurado" };
  }
  const gateway = !key.startsWith("fc-");
  const url = gateway
    ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape"
    : "https://api.firecrawl.dev/v2/scrape";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (gateway) {
    headers["authorization"] = `Bearer ${lovableKey}`;
    headers["X-Connection-Api-Key"] = key;
  } else {
    headers["authorization"] = `Bearer ${key}`;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ url: targetUrl, formats: ["html"], onlyMainContent: false }),
    });
    const body = (await res.json()) as {
      html?: string;
      data?: { html?: string };
      error?: string;
    };
    const html = body.html ?? body.data?.html;
    if (!res.ok || !html) {
      return {
        ok: false,
        httpStatus: res.status,
        durationMs: Date.now() - started,
        message: body.error ?? `Respaldo respondió ${res.status}`,
      };
    }
    return { ok: true, html, httpStatus: res.status, durationMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      durationMs: Date.now() - started,
      message: err instanceof Error ? err.message : "Fallo del servicio de respaldo",
    };
  }
}

export type ParsedCard = {
  name: string | null;
  expansion: string | null;
  priceFrom: number | null;
  priceAvg: number | null;
  priceTrend: number | null;
  availableItems: number | null;
};

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/&nbsp;/g, " ")
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Extracts price data from a Cardmarket product page. */
export function parseCardmarketProduct(html: string): ParsedCard {
  const text = html.replace(/\s+/g, " ");

  const pairs: Record<string, string> = {};
  const dlRe = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/g;
  let m: RegExpExecArray | null;
  while ((m = dlRe.exec(text)) !== null) {
    const key = stripTags(m[1]!).toLowerCase().replace(/:$/, "").trim();
    pairs[key] = stripTags(m[2]!);
  }

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const found = Object.keys(pairs).find((p) => p.includes(k));
      if (found) return pairs[found];
    }
    return undefined;
  };

  const titleMatch = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(text);
  const ogTitle = /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/.exec(text);
  const name = titleMatch ? stripTags(titleMatch[1]!) : ogTitle ? ogTitle[1]! : null;

  return {
    name: name && name.length > 0 ? name : null,
    expansion: pick("expansion", "edición", "edition", "set") ?? null,
    priceFrom: toNumber(pick("from", "desde", "precio desde")),
    priceAvg: toNumber(pick("30-days average", "media 30", "average price", "precio medio")),
    priceTrend: toNumber(pick("price trend", "tendencia")),
    availableItems: (() => {
      const n = toNumber(pick("available items", "artículos disponibles", "disponibles"));
      return n === null ? null : Math.round(n);
    })(),
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
