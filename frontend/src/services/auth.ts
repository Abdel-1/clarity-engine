const API_URL = (import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000") + "/api";

export async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Login failed");
  }
  return response.json();
}

export function saveToken(token: string) {
  localStorage.setItem("token", token);
}
export function saveRole(role: string) {
  localStorage.setItem("role", role);
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}
export function getRole(): string {
  // First try stored role
  const stored = localStorage.getItem("role");
  if (stored) return stored;
  // Fallback: decode JWT payload
  const token = getToken();
  if (!token) return "membre";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "membre";
  } catch {
    return "membre";
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
export function isAdmin(): boolean {
  return getRole() === "admin";
}

export function logout() {
  // Best-effort server-side revocation ("log out everywhere"): bumps the user's
  // token cutoff so the old token can't be reused. keepalive lets the request
  // finish even though the page navigates to /login immediately after.
  const token = localStorage.getItem("token");
  if (token) {
    try {
      fetch(`${API_URL}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore network errors on logout */ }
  }
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("client_id");
}

export function isBrandAdmin(): boolean {
  return getRole() === "brand_admin";
}

export function getClientId(): number | null {
  const v = localStorage.getItem("client_id");
  return v ? Number(v) : null;
}
