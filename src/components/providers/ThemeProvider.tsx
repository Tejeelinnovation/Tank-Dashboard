"use client";

import * as React from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark; the inline script in layout.tsx already applied the class
  // before paint, so we just need to stay in sync with what's on the DOM.
  const [theme, setThemeState] = React.useState<Theme>("dark");

  React.useEffect(() => {
    // Read what the inline script already applied so React state matches DOM
    const saved = (localStorage.getItem("theme") as Theme | null) ?? "dark";
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  function applyTheme(t: Theme) {
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.setAttribute("data-theme", t);
  }

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("theme", t);
    applyTheme(t);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  };

  // Render children immediately — no visibility:hidden wrapper.
  // The inline script in layout.tsx prevents flash before mount.
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
