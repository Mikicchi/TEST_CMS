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

/* ------------------------- raw HTTP proxy client ------------------------
 * `fetch()` cannot speak the HTTP proxy protocol, so the previous
 * implementation ("http://ip:port/https://target") never worked: every proxy
 * came back dead. We talk to the proxy over a raw TCP socket instead:
 *  - plain http targets  -> absolute-URI request line
 *  - https targets       -> CONNECT tunnel + TLS upgrade
 * ---------------------------------------------------------------------- */

type RawResponse = { status: number; body: string };

function dechunk(body: string): string {
  let out = "";
  let i = 0;
  while (i < body.length) {
    const nl = body.indexOf("\r\n", i);
    if (nl === -1) break;
    const size = Number.parseInt(body.slice(i, nl).trim(), 16);
    if (!Number.isFinite(size) || size <= 0) break;
    out += body.slice(nl + 2, nl + 2 + size);
    i = nl + 2 + size + 2;
  }
  return out || body;
}

function buildRequest(target: URL, absolute: boolean): string {
  const path = absolute ? target.toString() : `${target.pathname}${target.search}`;
  return (
    `GET ${path} HTTP/1.1\r\n` +
    `Host: ${target.host}\r\n` +
    `User-Agent: ${randomUserAgent()}\r\n` +
    `Accept: text/html,application/xhtml+xml\r\n` +
    `Accept-Language: es-ES,es;q=0.9,en;q=0.8\r\n` +
    `Accept-Encoding: identity\r\n` +
    `Connection: close\r\n\r\n`
  );
}

function parseRaw(raw: string): RawResponse {
  const split = raw.indexOf("\r\n\r\n");
  const head = split === -1 ? raw : raw.slice(0, split);
  let body = split === -1 ? "" : raw.slice(split + 4);
  const status = Number.parseInt(head.split(" ")[1] ?? "0", 10) || 0;
  if (/transfer-encoding:\s*chunked/i.test(head)) body = dechunk(body);
  return { status, body };
}

async function proxyRequest(
  targetUrl: string,
  proxy: { ip: string; port: number },
  timeoutMs: number,
): Promise<RawResponse> {
  const net = await import("node:net");
  const target = new URL(targetUrl);
  const secure = target.protocol === "https:";

  return await new Promise<RawResponse>((resolve, reject) => {
    let settled = false;
    const socket = net.connect({ host: proxy.ip, port: proxy.port });
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error("Tiempo de espera agotado con el proxy"));
      }
    }, timeoutMs);

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    };
    const done = (raw: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(parseRaw(raw));
    };

    socket.on("error", fail);

    socket.on("connect", () => {
      if (!secure) {
        let raw = "";
        socket.on("data", (d: Buffer) => {
          raw += d.toString("utf8");
        });
        socket.on("end", () => done(raw));
        socket.on("close", () => done(raw));
        socket.write(buildRequest(target, true));
        return;
      }

      // https: open a tunnel first
      let handshake = "";
      const onHandshake = async (d: Buffer) => {
        handshake += d.toString("utf8");
        if (!handshake.includes("\r\n\r\n")) return;
        socket.off("data", onHandshake);
        const code = Number.parseInt(handshake.split(" ")[1] ?? "0", 10);
        if (code !== 200) {
          fail(new Error(`El proxy rechazó el túnel (${code || "sin respuesta"})`));
          return;
        }
        try {
          const tls = await import("node:tls");
          const secured = tls.connect({
            socket,
            servername: target.hostname,
            rejectUnauthorized: false,
          });
          let raw = "";
          secured.on("error", fail);
          secured.on("data", (chunk: Buffer) => {
            raw += chunk.toString("utf8");
          });
          secured.on("end", () => done(raw));
          secured.on("close", () => done(raw));
          secured.on("secureConnect", () => secured.write(buildRequest(target, false)));
        } catch {
          fail(new Error("Este entorno no permite túneles cifrados a través del proxy"));
        }
      };
      socket.on("data", onHandshake);
      socket.write(
        `CONNECT ${target.hostname}:${target.port || 443} HTTP/1.1\r\nHost: ${target.hostname}:${
          target.port || 443
        }\r\nProxy-Connection: keep-alive\r\n\r\n`,
      );
    });
  });
}

/** Loads a URL through an open HTTP forward proxy. */
export async function fetchThroughProxy(
  targetUrl: string,
  proxy: { ip: string; port: number },
  timeoutMs = 12000,
): Promise<FetchAttempt> {
  const started = Date.now();
  try {
    const res = await proxyRequest(targetUrl, proxy, timeoutMs);
    const durationMs = Date.now() - started;
    const html = res.body;
    if (res.status === 0) {
      return { ok: false, durationMs, message: "El proxy no devolvió una respuesta válida" };
    }
    if (looksBlocked(html, res.status)) {
      return {
        ok: false,
        httpStatus: res.status,
        durationMs,
        blocked: true,
        message: "Bloqueo detectado en la respuesta",
      };
    }
    if (res.status >= 400 || html.length < 200) {
      return {
        ok: false,
        httpStatus: res.status,
        durationMs,
        message: `Respuesta no válida del proxy (${res.status})`,
      };
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
