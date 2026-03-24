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

  const py1 = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-10, 60]);
  const py2 = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [-20, 80]);
  const py3 = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 100]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  const smx = useSpring(mx, { stiffness: 20, damping: 30 });
  const smy = useSpring(my, { stiffness: 20, damping: 30 });

  const mouseX = useTransform(smx, [-1, 1], reduce ? [0, 0] : [-15, 15]);
  const mouseY = useTransform(smy, [-1, 1], reduce ? [0, 0] : [-12, 12]);

  const y1 = useMotionTemplate`calc(${py1}px + ${mouseY}px)`;
  const y2 = useMotionTemplate`calc(${py2}px + ${mouseY}px)`;
  const y3 = useMotionTemplate`calc(${py3}px + ${mouseY}px)`;

  React.useEffect(() => {
    if (!mounted || reduce) return;

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;

      mx.set((e.clientX / w) * 2 - 1);
      my.set((e.clientY / h) * 2 - 1);
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
    };
  }, [mounted, mx, my, reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#050814]" />

      <motion.div
        className="absolute left-[60%] top-[-250px] -translate-x-1/2"
        style={{ x: mouseX, y: y1 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-[700px] w-[700px] rounded-full blur-[220px] opacity-70"
          style={{
            background:
              "radial-gradient(circle, rgba(0,225,255,0.9), transparent 70%)",
          }}
        />
      </motion.div>

      <motion.div
        className="absolute left-[25%] top-[-100px] -translate-x-1/2"
        style={{ x: mouseX, y: y2 }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-[600px] w-[600px] rounded-full blur-[200px] opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(255,80,180,0.85), transparent 70%)",
          }}
        />
      </motion.div>

      <motion.div
        className="absolute left-[50%] top-[-120px] -translate-x-1/2"
        style={{ x: mouseX, y: y3 }}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="h-[850px] w-[850px] rounded-full blur-[260px] opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(255,170,40,0.7), transparent 70%)",
          }}
        />
      </motion.div>
    </div>
  );
}