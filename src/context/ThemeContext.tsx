// "use client";

// import React, { createContext, useContext, useEffect, useState } from "react";
// import { Theme, setTheme, getTheme } from "@/lib/theme";

// interface ThemeContextType {
//   theme: Theme;
//   toggleTheme: () => void;
//   setThemeMode: (theme: Theme) => void;
// }

// const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// export function ThemeProvider({ children }: { children: React.ReactNode }) {
//   const [theme, setThemeState] = useState<Theme>("light");
//   const [mounted, setMounted] = useState(false);

//   useEffect(() => {
//     setMounted(true);
//     const initialTheme = getTheme();
//     setThemeState(initialTheme);
//     setTheme(initialTheme);
//   }, []);

//   const toggleTheme = () => {
//     setThemeState((prev) => {
//       const newTheme: Theme = prev === "light" ? "dark" : "light";
//       setTheme(newTheme);
//       return newTheme;
//     });
//   };

//   const setThemeMode = (newTheme: Theme) => {
//     setThemeState(newTheme);
//     setTheme(newTheme);
//   };

//   if (!mounted) {
//     return <>{children}</>;
//   }

//   return (
//     <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode }}>
//       {children}
//     </ThemeContext.Provider>
//   );
// }

// export function useTheme() {
//   const context = useContext(ThemeContext);
//   if (!context) {
//     throw new Error("useTheme must be used within ThemeProvider");
//   }
//   return context;
// }
