# Theme System Setup

Your Tank Dashboard now has a fully functional dark/light theme system!

## Features

- **Automatic Theme Detection**: Respects system preference on first visit
- **LocalStorage Persistence**: Remembers user's theme choice
- **Class-Based Switching**: Uses the `dark` class on the `<html>` element
- **Smooth Transitions**: Animated color transitions between themes
- **Context API**: Easy theme access throughout the app with `useTheme()` hook

## How to Use

### 1. Add the Theme Toggle Button

Add the `ThemeToggle` component to your header or navigation:

```tsx
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  return (
    <header className="flex items-center justify-between p-4">
      <h1>Tank Dashboard</h1>
      <ThemeToggle />
    </header>
  );
}
```

### 2. Access Theme in Your Components

Use the `useTheme()` hook to access theme state:

```tsx
"use client";

import { useTheme } from "@/context/ThemeContext";

export function MyComponent() {
  const { theme, toggleTheme, setThemeMode } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setThemeMode("dark")}>Dark Mode</button>
      <button onClick={() => setThemeMode("light")}>Light Mode</button>
    </div>
  );
}
```

### 3. Using Theme Colors in Tailwind

The theme system provides Tailwind classes that automatically respond to theme changes:

```tsx
<div className="bg-white dark:bg-gray-900 text-black dark:text-white">
  Content that adapts to theme
</div>
```

## Theme CSS Variables

The following CSS variables are available and automatically applied based on the theme:

- `--background`: Background color
- `--foreground`: Text color
- `--card-bg`: Card background color
- `--border`: Border color
- `--input-bg`: Input field background
- `--input-border`: Input field border color

Use them in your CSS:

```css
.my-element {
  background-color: var(--background);
  color: var(--foreground);
  border: 1px solid var(--border);
}
```

## Light Theme Colors

- Background: `#ffffff`
- Foreground: `#171717`
- Card: `#f5f5f5`
- Border: `#e5e5e5`

## Dark Theme Colors

- Background: `#0a0a0a`
- Foreground: `#ededed`
- Card: `#1a1a1a`
- Border: `#27272a`

## Files Created/Modified

1. **Created**: `src/lib/theme.ts` - Theme utility functions
2. **Created**: `src/context/ThemeContext.tsx` - Theme provider and hook
3. **Created**: `src/components/ui/ThemeToggle.tsx` - Toggle button component
4. **Created**: `tailwind.config.ts` - Tailwind configuration for dark mode
5. **Created**: `src/lib/themeScript.ts` - Script to prevent theme flash
6. **Modified**: `src/app/globals.css` - Updated with theme variables
7. **Modified**: `src/app/layout.tsx` - Added ThemeProvider

## Advanced: Prevent Theme Flash

If you want to prevent a flash of the wrong theme on page load, add this to your root layout before other scripts:

```tsx
import { themeScript } from "@/lib/themeScript";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: themeScript }}
          suppressHydrationWarning
        />
      </head>
      <body>{/* ... */}</body>
    </html>
  );
}
```

Enjoy your new theme system! 🎨
