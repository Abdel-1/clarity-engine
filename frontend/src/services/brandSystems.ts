import { getToken, logout } from "./auth";

const API = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000") + "/api";

export interface PointItem  { text: string; evidence?: string }
export interface RecoItem   { text: string; brand_element?: string }

export interface ConversationAnalysis {
  id: number; message_title: string; brand_system_name: string;
  clarity_score: number; narrative_risk: string;
  sub_lisibilite: number; sub_alignment: number; sub_focus: number;
  sub_tone: number; sub_narrative_contribution: number;
  conversation_id: string; iteration_index: number;
  analyzed_at: string;
  reasoning?: Record<string, string>;
  points_forts: PointItem[];
  points_faibles: PointItem[];
  recommandations: RecoItem[];
  message_body: string; channel: string; content_type: string;
  analyzed_by: string | null;
}

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

/** Handle 401 redirect, throw a clean error on any non-2xx, else parse JSON.
 *  Same behaviour as the inline guard in getMemberDashboard, factored out. */
async function okJson(r: Response) {
  handle401(r);
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json())?.detail ?? ""; } catch { /* non-JSON body */ }
    throw new Error(`Erreur ${r.status}${detail ? ` : ${detail}` : ""}`);
  }
  return r.json();
}

export async function getBrandSystems() {
  const r = await fetch(`${API}/brand-systems`, { headers: authHeaders() });
  return okJson(r);
}
export async function getBrandSystem(id: number) {
  const r = await fetch(`${API}/brand-systems/${id}`, { headers: authHeaders() });
  return okJson(r);
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
  // Supported filter keys: channel, content_type, risk, date_from, date_to,
  // brand_system_id (admin), user_email (brand_admin)
  const p = new URLSearchParams(filters).toString();
  const r = await fetch(`${API}/analyses${p ? "?" + p : ""}`, { headers: authHeaders() });
  handle401(r);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
export async function getStats() {
  const r = await fetch(`${API}/analyses/stats`, { headers: authHeaders() });
  return okJson(r);
}
export async function getConversations(brandSystemId?: number, userEmail?: string) {
  const params = new URLSearchParams();
  if (brandSystemId) params.append("brand_system_id", brandSystemId.toString());
  if (userEmail) params.append("user_email", userEmail);
  
  const url = `${API}/history/conversations${params.toString() ? "?" + params.toString() : ""}`;
  const r = await fetch(url, { headers: authHeaders() });
  handle401(r);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export interface BrandMember {
  email: string;
  full_name: string;
  analysis_count: number;
}

export async function getBrandMembers(): Promise<BrandMember[]> {
  const r = await fetch(`${API}/brand/members`, { headers: authHeaders() });
  handle401(r);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export interface AdminBrandSystem {
  id: number;
  brand_name: string;
  client_id: number;
  company_name: string;
  sector: string | null;
  analysis_count: number;
  last_analysis_at: string | null;
}

export async function getAdminBrandSystems(): Promise<AdminBrandSystem[]> {
  const r = await fetch(`${API}/admin/brand-systems`, { headers: authHeaders() });
  handle401(r);
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
export async function getConversation(conversationId: string) {
  const r = await fetch(`${API}/history/${conversationId}`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Conversation not found");
  return r.json() as Promise<ConversationAnalysis[]>;
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
  const r = await fetch(`${API}/brand-systems/import`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Upload failed");
  }
  return r.json();
}

/** v1 extraction — returns full schema with champs_manquants */
export interface ExtractionResult {
  status: string;
  extraction_version: number;
  sources: string[];
  char_count: number;
  errors: string[];
  data: {
    nom_marque: string;
    role_marque: string;
    master_statement: string;
    priorites_strategiques: string[];
    territoires_narratifs: string[];
    ton_marque: string;
    lignes_rouges: string[];
    mots_a_privilegier: string[];
    mots_a_eviter: string[];
    audiences_cles: string[];
    contexte_sectoriel: string;
    champs_manquants: string[];
  };
}

export async function extractBrandSystem(files: File[]): Promise<ExtractionResult> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const r = await fetch(`${API}/brand-system/extract`, {
    method: "POST",
    headers: authHeaders(),   // auth only, no Content-Type
    body: form,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: "Extraction échouée" }));
    throw new Error(err.detail || "Extraction échouée");
  }
  return r.json();
}

/* ── Dashboard KPI endpoints ─────────────────────────────────────── */

export async function getMemberDashboard() {
  const r = await fetch(`${API}/dashboard/member`, { headers: authHeaders() });
  handle401(r);
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json())?.detail ?? ""; } catch { /* non-JSON body */ }
    throw new Error(`Erreur ${r.status} lors du chargement du tableau de bord${detail ? ` : ${detail}` : ""}`);
  }
  return r.json();
}

export async function getBrandDashboard() {
  const r = await fetch(`${API}/brand/dashboard`, { headers: authHeaders() });
  return okJson(r);
}

export async function getAdminDashboard() {
  const r = await fetch(`${API}/admin/dashboard`, { headers: authHeaders() });
  return okJson(r);
}

export interface TokenBrand {
  brand_system_id: number; brand_system_name: string;
  total_tokens: number; prompt_tokens: number; completion_tokens: number;
  analyses: number; pct: number; cost: number;
}
export interface TokenUsage {
  grand_total_tokens: number; grand_total_cost: number; total_analyses: number;
  by_brand: TokenBrand[];
  brand_systems: { id: number; name: string }[];
  pricing: { input_per_1m: number; output_per_1m: number; currency: string };
  filters: { start: string | null; end: string | null; brand_system_id: number | null };
}

/** Admin: API token consumption per brand system, with optional date + brand filters. */
export async function getAdminTokenUsage(
  params: { start?: string; end?: string; brandSystemId?: number } = {},
): Promise<TokenUsage> {
  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end)   qs.set("end", params.end);
  if (params.brandSystemId != null) qs.set("brand_system_id", String(params.brandSystemId));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const r = await fetch(`${API}/admin/token-usage${suffix}`, { headers: authHeaders() });
  return okJson(r);
}

/* ── Analysis access control (admin can suspend the engine) ──────────── */
export interface AnalysisAccess {
  member_enabled: boolean;
  message: string | null;
  brands: { id: number; brand_name: string; enabled: boolean }[];
}

/** Whether the analysis engine is available for the current user, and which of
 *  their brand systems are individually suspended. Drives the Analyze lock. */
export async function getAnalysisAccess(): Promise<AnalysisAccess> {
  const r = await fetch(`${API}/analysis-access`, { headers: authHeaders() });
  return okJson(r);
}

/** Admin: enable/disable the analysis engine for an entire brand system. */
export async function setBrandSystemAccess(bsId: number, enabled: boolean) {
  const r = await fetch(`${API}/admin/brand-systems/${bsId}/access`, {
    method: "PATCH", headers: authHeaders(true),
    body: JSON.stringify({ enabled }),
  });
  return okJson(r);
}

/** Admin: enable/disable the analysis engine for a single member. */
export async function setMemberAccess(userId: number, enabled: boolean) {
  const r = await fetch(`${API}/admin/users/${userId}/access`, {
    method: "PATCH", headers: authHeaders(true),
    body: JSON.stringify({ enabled }),
  });
  return okJson(r);
}

export async function getMemberUnreviewed() {
  const r = await fetch(`${API}/dashboard/unreviewed`, { headers: authHeaders() });
  return okJson(r);
}

export async function getBrandUnreviewed() {
  const r = await fetch(`${API}/brand/unreviewed`, { headers: authHeaders() });
  return okJson(r);
}

export async function getAdminUnreviewed() {
  const r = await fetch(`${API}/admin/unreviewed`, { headers: authHeaders() });
  return okJson(r);
}
