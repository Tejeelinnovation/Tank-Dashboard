"use client";

import * as React from "react";
import { useTheme } from "@/components/providers/ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className="rounded-full border border-black/10 dark:border-white/20 bg-black/5 dark:bg-white/10 px-4 py-2 text-xs font-semibold text-black dark:text-white transition hover:bg-black/10 dark:hover:bg-white/20"
    >
      {/* Suppress hydration mismatch — only show label after mount */}
      <span suppressHydrationWarning>
        {mounted ? (theme === "dark" ? "☀ Light" : "☾ Dark") : "Theme"}
      </span>
    </button>
  );
}