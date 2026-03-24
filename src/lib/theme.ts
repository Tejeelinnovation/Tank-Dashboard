export type Theme = "light" | "dark";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  
  const stored = localStorage.getItem("theme") as Theme | null;
  if (stored) return stored;
  
  // Check system preference
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  
  return "light";
}

export function setTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  const root = document.documentElement;
  
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function initTheme() {
  const theme = getTheme();
  setTheme(theme);
}
