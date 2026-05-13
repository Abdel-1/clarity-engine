const API_URL = "http://127.0.0.1:8000";

export async function login(email: string, password: string) {
  const response = await fetch(
    `${API_URL}/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
    { method: "POST" }
  );
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
  if (!token) return "client";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || "client";
  } catch {
    return "client";
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
export function isAdmin(): boolean {
  return getRole() === "admin";
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}
