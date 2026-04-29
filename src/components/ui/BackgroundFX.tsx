"use client";

import * as React from "react";

/**
 * BackgroundFX — Stable, CSS-only background with subtle color cycling.
 * Grid is less visible. Optimized for performance and stability.
 */
export default function BackgroundFX() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 z-0 bg-white dark:bg-[#050814]" />;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
      {/* Base Layer */}
      <div className="absolute inset-0 bg-white dark:bg-[#050814] transition-colors duration-700" />

      {/* Static Gradient Blobs with CSS animation for color cycling */}
      <style jsx>{`
        @keyframes hueCycle {
          from { filter: hue-rotate(0deg); }
          to { filter: hue-rotate(360deg); }
        }
        .color-cycle {
          animation: hueCycle 60s linear infinite;
        }
      `}</style>

      <div className="absolute inset-0 color-cycle">
        {/* Blob 1: Top Right */}
        <div 
          className="absolute -top-[20%] -right-[10%] h-[80%] w-[70%] rounded-full opacity-35 blur-[120px] dark:opacity-15 dark:blur-[160px]"
          style={{
            background: 'radial-gradient(circle, hsla(210, 80%, 70%, 0.6), hsla(210, 80%, 70%, 0) 70%)'
          }}
        />

        {/* Blob 2: Top Left */}
        <div 
          className="absolute -top-[15%] -left-[15%] h-[70%] w-[60%] rounded-full opacity-25 blur-[100px] dark:opacity-12 dark:blur-[140px]"
          style={{
            background: 'radial-gradient(circle, hsla(275, 75%, 75%, 0.5), hsla(275, 75%, 75%, 0) 70%)'
          }}
        />

        {/* Blob 3: Center Left */}
        <div 
          className="absolute top-[20%] -left-[20%] h-[60%] w-[50%] rounded-full opacity-15 blur-[120px] dark:opacity-8 dark:blur-[150px]"
          style={{
            background: 'radial-gradient(circle, hsla(325, 70%, 80%, 0.4), hsla(325, 70%, 80%, 0) 70%)'
          }}
        />
      </div>

      {/* Subtle Grid Overlay — Made even less visible (0.01 / 0.03) */}
      <div 
        className="absolute inset-0 opacity-[0.01] dark:opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Subtle Noise Layer */}
      <div
        className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] mix-blend-multiply dark:mix-blend-soft-light"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27100%27 height=%27100%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.75%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%27 height=%27100%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
          backgroundRepeat: "repeat",
        }}
      />

      {/* Theme Vignettes */}
      <div className="hidden dark:block absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.02),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.01)_100%)] dark:bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.15)_100%)]" />
    </div>
  );
}