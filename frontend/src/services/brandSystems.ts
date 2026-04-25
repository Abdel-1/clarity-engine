const API = "http://127.0.0.1:8000/api";

export async function getBrandSystems() {
  const r = await fetch(`${API}/brand-systems`);
  return r.json();
}
export async function getBrandSystem(id: number) {
  const r = await fetch(`${API}/brand-systems/${id}`);
  return r.json();
}
export async function createBrandSystem(data: Record<string, string>) {
  const r = await fetch(`${API}/brand-systems`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function updateBrandSystem(id: number, data: Record<string, string>) {
  const r = await fetch(`${API}/brand-systems/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function postAnalyze(payload: Record<string, unknown>) {
  const r = await fetch(`${API}/analyze`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function getAnalysis(id: number | string) {
  const r = await fetch(`${API}/analyses/${id}`);
  if (!r.ok) throw new Error("Analysis not found");
  return r.json();
}
export async function getAnalyses(filters: Record<string, string> = {}) {
  const p = new URLSearchParams(filters).toString();
  const r = await fetch(`${API}/analyses${p ? "?" + p : ""}`);
  return r.json();
}
export async function getStats() {
  const r = await fetch(`${API}/analyses/stats`);
  return r.json();
}
