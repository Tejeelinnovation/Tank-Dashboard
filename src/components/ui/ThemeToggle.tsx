"use client";

import * as React from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>("dark");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);

    const saved = (localStorage.getItem("theme") as Theme | null) ?? "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("dark", saved === "dark");
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.setAttribute("data-theme", next);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className="rounded-full border border-black/10 bg-black/5 px-4 py-2 text-xs font-semibold text-black dark:border-white/20 dark:bg-white/10 dark:text-white"
      >
        Theme
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-black/10 bg-black/5 px-4 py-2 text-xs font-semibold text-black transition hover:bg-black/10 dark:border-white/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
    >
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}