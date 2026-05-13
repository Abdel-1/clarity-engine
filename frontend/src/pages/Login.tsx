import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, saveToken, saveRole } from "../services/auth";
import logoSvg from "../assets/logo.svg";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await login(email, password);
      saveToken(res.access_token);
      saveRole(res.role || "client");
      nav(res.role === "admin" ? "/admin" : "/");
    } catch {
      setError("Invalid email or password.");
    } finally { setLoading(false); }
  };

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
            </svg>
          </div>
          <p className="login-title">Clarity Engine</p>
          <p className="login-sub">Brand governance platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Email</label>
            <input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@clarity.com" required autoFocus />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button id="login-btn" type="submit" className="login-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{marginTop:28, borderTop:"1px solid var(--border)", paddingTop:20, textAlign:"center"}}>
          <img src={logoSvg} alt="Zone Bleue" style={{height:28, opacity:0.5}} />
        </div>
      </div>
    </div>
  );
}
