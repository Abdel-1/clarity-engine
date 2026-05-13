const API_URL = "http://127.0.0.1:8000";

// ── Login / Logout ─────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const response = await fetch(
    `${API_URL}/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    { method: "POST" }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }

  const data = await response.json();

  // Persist token + role so the frontend never has to decode the JWT
  saveSession(data.access_token, data.role ?? "client", data.client_id ?? null);

  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("client_id");
}

// ── Session persistence ────────────────────────────────────────────────────

export function saveSession(
  token: string,
  role: string,
  clientId: number | null
) {
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
  if (clientId !== null) {
    localStorage.setItem("client_id", String(clientId));
  } else {
    localStorage.removeItem("client_id");
  }
}

// ── Token helpers ──────────────────────────────────────────────────────────

export function saveToken(token: string) {
  localStorage.setItem("token", token);
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ── Role helpers ───────────────────────────────────────────────────────────

export function getRole(): string {
  return localStorage.getItem("role") ?? "client";
}

export function isAdmin(): boolean {
  return getRole() === "admin";
}

export function getClientId(): number | null {
  const v = localStorage.getItem("client_id");
  return v ? Number(v) : null;
}
