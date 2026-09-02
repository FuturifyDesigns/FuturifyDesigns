const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const encoder = new TextEncoder();

function base64Url(value: string) {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return atob(padded);
}

async function sign(value: string) {
  const secret = Deno.env.get("CMS_SESSION_SECRET") || "";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return base64Url(String.fromCharCode(...new Uint8Array(signature)));
}

async function createSession() {
  const payload = base64Url(JSON.stringify({ exp: Date.now() + 8 * 60 * 60 * 1000 }));
  return `${payload}.${await sign(payload)}`;
}

async function validSession(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !token.includes(".")) return false;
  const [payload, signature] = token.split(".");
  if (signature !== await sign(payload)) return false;
  try {
    return JSON.parse(decodeBase64Url(payload)).exp > Date.now();
  } catch {
    return false;
  }
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isValidPageKey(pageKey: unknown): pageKey is string {
  return typeof pageKey === "string" && /^[a-z0-9_-]+\.html$/.test(pageKey);
}

async function database(path: string, init: RequestInit = {}) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (request.method === "GET") {
    const result = await database("cms_pages?select=page_key,content");
    if (!result.ok) return response({ error: "Unable to load site content." }, 500);
    const rows = await result.json();
    const pages: Record<string, unknown> = {};
    for (const row of rows) pages[row.page_key] = row.content;
    return response({ pages });
  }

  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);
  const body = await request.json().catch(() => ({}));

  if (body.action === "login") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (email !== (Deno.env.get("CMS_ADMIN_EMAIL") || "").toLowerCase() || password !== Deno.env.get("CMS_ADMIN_PASSWORD")) {
      return response({ error: "Incorrect login details." }, 401);
    }
    return response({ token: await createSession() });
  }

  if (!(await validSession(request))) return response({ error: "Your admin session has expired." }, 401);
  if (!isValidPageKey(body.pageKey)) return response({ error: "Invalid page." }, 400);

  if (body.action === "save") {
    if (!body.content || typeof body.content !== "object") return response({ error: "Invalid content." }, 400);
    const result = await database("cms_pages?on_conflict=page_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({ page_key: body.pageKey, content: body.content, updated_at: new Date().toISOString() }),
    });
    if (!result.ok) return response({ error: "Unable to save content." }, 500);
    return response({ ok: true });
  }

  if (body.action === "reset") {
    const result = await database(`cms_pages?page_key=eq.${encodeURIComponent(body.pageKey)}`, { method: "DELETE" });
    if (!result.ok) return response({ error: "Unable to reset content." }, 500);
    return response({ ok: true });
  }

  return response({ error: "Unknown action." }, 400);
});
