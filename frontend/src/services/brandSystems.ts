import { getToken, logout } from "./auth";

const API = "http://127.0.0.1:8000/api";

/** Shared auth + content-type headers for every API call */
function authHeaders(json = false): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${getToken() ?? ""}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

/** If the server returns 401, clear session and redirect to login */
function handle401(r: Response) {
  if (r.status === 401) { logout(); window.location.href = "/login"; }
  return r;
}

export async function getBrandSystems() {
  const r = await fetch(`${API}/brand-systems`, { headers: authHeaders() });
  handle401(r);
  return r.json();
}
export async function getBrandSystem(id: number) {
  const r = await fetch(`${API}/brand-systems/${id}`, { headers: authHeaders() });
  return r.json();
}
export async function createBrandSystem(data: Record<string, string>) {
  const r = await fetch(`${API}/brand-systems`, {
    method: "POST", headers: authHeaders(true),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function updateBrandSystem(id: number, data: Record<string, string>) {
  const r = await fetch(`${API}/brand-systems/${id}`, {
    method: "PUT", headers: authHeaders(true),
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function postAnalyze(payload: Record<string, unknown>) {
  const r = await fetch(`${API}/analyze`, {
    method: "POST", headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function getAnalysis(id: number | string) {
  const r = await fetch(`${API}/analyses/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Analysis not found");
  return r.json();
}
export async function getAnalyses(filters: Record<string, string> = {}) {
  const p = new URLSearchParams(filters).toString();
  const r = await fetch(`${API}/analyses${p ? "?" + p : ""}`, { headers: authHeaders() });
  handle401(r);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
export async function getStats() {
  const r = await fetch(`${API}/analyses/stats`, { headers: authHeaders() });
  handle401(r);
  return r.json();
}
export async function postRewrite(payload: {
  brand_system_id: number;
  original_message: string;
  instruction: string;
  points_faibles?: string[];
  recommandations?: string[];
}) {
  const r = await fetch(`${API}/rewrite`, {
    method: "POST", headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{ rewritten_message: string; changes_made: string[] }>;
}

export async function importBrandFromFiles(files: File[]): Promise<{
  status: string;
  sources: string[];
  char_count: number;
  errors: string[];
  data: Record<string, string>;
}> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  // Note: no Content-Type header — browser sets multipart boundary automatically
  const r = await fetch(`${API}/brand-systems/import`, {
    method: "POST",
    headers: authHeaders(),   // auth only, no Content-Type
    body: form,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return r.json();
}
