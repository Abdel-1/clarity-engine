import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({
  theme: "dark",
  toggleTheme: () => {},
});

const ALWAYS_DARK_ROUTES = ["/login"];
const isAlwaysDark = () => ALWAYS_DARK_ROUTES.some(r => window.location.pathname.startsWith(r));

/** Briefly adds .theme-transitioning to <html> so all elements animate
 *  simultaneously (one coordinated 220ms sweep) then removes it. */
function applyTheme(effectiveTheme: Theme) {
  const root = document.documentElement;

  // Kick off the coordinated transition
  root.classList.add("theme-transitioning");

  // Swap theme
  root.classList.remove("dark", "light");
  root.classList.add(effectiveTheme);
  root.setAttribute("data-theme", effectiveTheme);

  // Remove the transition class after animation completes
  const cleanup = setTimeout(() => root.classList.remove("theme-transitioning"), 250);
  return () => clearTimeout(cleanup);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") return stored;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    } catch {
      return "dark";
    }
  });

  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  /* Apply theme on every change — but ALWAYS force dark on the login page */
  useEffect(() => {
    const effectiveTheme = isAlwaysDark() ? "dark" : theme;
    const cancel = applyTheme(effectiveTheme);
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    return cancel;
  }, [theme]);

  /* Also enforce on first render to prevent any flash — no transition needed */
  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme = isAlwaysDark() ? "dark" : theme;
    root.classList.remove("dark", "light");
    root.classList.add(effectiveTheme);
    root.setAttribute("data-theme", effectiveTheme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
