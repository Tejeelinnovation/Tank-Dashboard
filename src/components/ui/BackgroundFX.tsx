"use client";

import * as React from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionTemplate,
} from "framer-motion";

export default function BackgroundFX() {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll();

  const py1 = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-20, 100]);
  const py2 = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-40, 140]);
  const py3 = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 180]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const smx = useSpring(mx, { stiffness: 50, damping: 18, mass: 0.7 });
  const smy = useSpring(my, { stiffness: 50, damping: 18, mass: 0.7 });

  const mouseX = useTransform(smx, [-1, 1], reduce ? [0, 0] : [-24, 24]);
  const mouseY = useTransform(smy, [-1, 1], reduce ? [0, 0] : [-18, 18]);

  const y1 = useMotionTemplate`calc(${py1}px + ${mouseY}px)`;
  const y2 = useMotionTemplate`calc(${py2}px + ${mouseY}px)`;
  const y3 = useMotionTemplate`calc(${py3}px + ${mouseY}px)`;

  React.useEffect(() => {
    if (!mounted || reduce) return;

    let raf = 0;

    const onMove = (e: PointerEvent) => {
      if (raf) return;

      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;

        const nx = (e.clientX / w) * 2 - 1;
        const ny = (e.clientY / h) * 2 - 1;

        mx.set(Math.max(-1, Math.min(1, nx)));
        my.set(Math.max(-1, Math.min(1, ny)));
      });
    };

    const onLeave = () => {
      mx.set(0);
      my.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [mounted, mx, my, reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050814]" />

      <motion.div
        className="absolute left-[58%] top-[-290px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseX : 0, y: mounted ? y1 : 0 }}
        animate={
          mounted && !reduce
            ? {
                x: [0, 24, -16, 0],
                y: [0, -24, 18, 0],
                scale: [1, 1.08, 0.98, 1],
                rotate: [0, 2, -2, 0],
              }
            : undefined
        }
        transition={
          mounted && !reduce
            ? { duration: 20, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      >
        <div
          className="h-[760px] w-[760px] rounded-full blur-[240px] opacity-80"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(0,225,255,0.95), rgba(0,225,255,0.32) 38%, transparent 68%)",
          }}
        />
      </motion.div>

      <motion.div
        className="absolute left-[24%] top-[-110px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseX : 0, y: mounted ? y2 : 0 }}
        animate={
          mounted && !reduce
            ? {
                x: [0, -18, 14, 0],
                y: [0, -16, 12, 0],
                scale: [1, 1.04, 0.98, 1],
                rotate: [0, -1.5, 1.5, 0],
              }
            : undefined
        }
        transition={
          mounted && !reduce
            ? { duration: 24, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      >
        <div
          className="h-[680px] w-[680px] rounded-full blur-[230px] opacity-70"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,80,180,0.92), rgba(255,80,180,0.28) 40%, transparent 68%)",
          }}
        />
      </motion.div>

      <motion.div
        className="absolute left-[50%] top-[-140px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseX : 0, y: mounted ? y3 : 0 }}
        animate={
          mounted && !reduce
            ? {
                x: [0, 12, -10, 0],
                y: [0, -12, 10, 0],
                scale: [1, 1.03, 0.99, 1],
              }
            : undefined
        }
        transition={
          mounted && !reduce
            ? { duration: 28, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      >
        <div
          className="h-[920px] w-[920px] rounded-full blur-[280px] opacity-65"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,170,40,0.78), rgba(255,170,40,0.20) 42%, transparent 72%)",
          }}
        />
      </motion.div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(255,255,255,0.04),rgba(0,0,0,0.12)_30%,rgba(0,0,0,0.55)_60%,rgba(0,0,0,0.9)_100%)]" />

      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-soft-light"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27 opacity=%270.5%27/%3E%3C/svg%3E")',
          backgroundRepeat: "repeat",
          backgroundSize: "240px 240px",
        }}
      />
    </div>
  );
}