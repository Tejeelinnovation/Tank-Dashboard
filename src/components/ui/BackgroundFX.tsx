"use client";

import * as React from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  animate,
} from "framer-motion";

export default function BackgroundFX() {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll();

  // Keep blobs naturally near the top while allowing gentle scroll drift
  const py1 = useTransform(scrollYProgress, [0, 1], [-12, 48]);
  const py2 = useTransform(scrollYProgress, [0, 1], [-8, 70]);
  const py3 = useTransform(scrollYProgress, [0, 1], [-16, 84]);
  const py4 = useTransform(scrollYProgress, [0, 1], [-10, 58]);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  // Softer mouse response
  const smx = useSpring(mx, { stiffness: 90, damping: 24, mass: 0.9 });
  const smy = useSpring(my, { stiffness: 90, damping: 24, mass: 0.9 });

  // Much smaller mouse movement so blobs stay near top
  const mouseXWide = useTransform(smx, [-1, 1], [-90, 90]);
  const mouseXNarrow = useTransform(smx, [-1, 1], [-55, 55]);
  const mouseYWide = useTransform(smy, [-1, 1], [-18, 18]);
  const mouseYNarrow = useTransform(smy, [-1, 1], [-10, 10]);

  const y1 = useMotionTemplate`calc(${py1}px + ${mouseYWide}px)`;
  const y2 = useMotionTemplate`calc(${py2}px + ${mouseYNarrow}px)`;
  const y3 = useMotionTemplate`calc(${py3}px + ${mouseYWide}px)`;
  const y4 = useMotionTemplate`calc(${py4}px + ${mouseYNarrow}px)`;

  const hueA = useMotionValue(210);
  const hueB = useMotionValue(275);
  const hueC = useMotionValue(325);
  const hueD = useMotionValue(165);

  React.useEffect(() => {
    if (!mounted) return;

    // Slower, calmer color cycling
    const controls = [
      animate(hueA, 330, { duration: 34, repeat: Infinity, ease: "linear" }),
      animate(hueB, 395, { duration: 20, repeat: Infinity, ease: "linear" }),
      animate(hueC, 450, { duration: 24, repeat: Infinity, ease: "linear" }),
      animate(hueD, 520, { duration: 28, repeat: Infinity, ease: "linear" }),
    ];

    return () => controls.forEach((c) => c.stop());
  }, [mounted, hueA, hueB, hueC, hueD]);

  // Reduced saturation + softer opacity for less harsh color
  const bg1 = useMotionTemplate`radial-gradient(circle at 50% 50%, hsla(${hueA}, 72%, 60%, 0.62), hsla(${hueA}, 68%, 54%, 0.26) 40%, transparent 72%)`;
  const bg2 = useMotionTemplate`radial-gradient(circle at 50% 50%, hsla(${hueB}, 68%, 62%, 0.48), hsla(${hueB}, 64%, 56%, 0.20) 42%, transparent 74%)`;
  const bg3 = useMotionTemplate`radial-gradient(circle at 50% 50%, hsla(${hueC}, 66%, 60%, 0.40), hsla(${hueC}, 62%, 55%, 0.16) 44%, transparent 76%)`;
  const bg4 = useMotionTemplate`radial-gradient(circle at 50% 50%, hsla(${hueD}, 60%, 58%, 0.28), hsla(${hueD}, 56%, 52%, 0.10) 44%, transparent 76%)`;

  React.useEffect(() => {
    if (!mounted) return;

    let raf = 0;

    const updateMouse = (clientX: number, clientY: number) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;

      const nx = (clientX / w) * 2 - 1;
      const ny = (clientY / h) * 2 - 1;

      mx.set(Math.max(-1, Math.min(1, nx)));
      my.set(Math.max(-1, Math.min(1, ny)));
    };

    const move = (clientX: number, clientY: number) => {
      if (raf) cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        updateMouse(clientX, clientY);
      });
    };

    const onPointerMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      move(touch.clientX, touch.clientY);
    };

    const reset = () => {
      mx.set(0);
      my.set(0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("mouseleave", reset, { passive: true });
    window.addEventListener("pointerleave", reset, { passive: true });
    window.addEventListener("blur", reset);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseleave", reset);
      window.removeEventListener("pointerleave", reset);
      window.removeEventListener("blur", reset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mounted, mx, my]);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-white dark:bg-[#050814] transition-colors duration-500" />

      <motion.div
        className="absolute left-[55%] top-[-340px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseXWide : 0, y: mounted ? y1 : 0 }}
      >
        <motion.div
          animate={{
            x: [0, 12, -8, 0],
            y: [0, -10, 6, 0],
            scale: [1, 1.03, 0.99, 1],
            rotate: [0, 1, -1, 0],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="h-[860px] w-[1120px] rounded-full blur-[150px] opacity-90"
            style={{ background: bg1 }}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute left-[18%] top-[-210px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseXNarrow : 0, y: mounted ? y2 : 0 }}
      >
        <motion.div
          animate={{
            x: [0, -10, 8, 0],
            y: [0, -8, 5, 0],
            scale: [1, 1.025, 0.995, 1],
            rotate: [0, -0.8, 0.8, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="h-[620px] w-[620px] rounded-full blur-[145px] opacity-75"
            style={{ background: bg2 }}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute left-[84%] top-[-190px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseXNarrow : 0, y: mounted ? y3 : 0 }}
      >
        <motion.div
          animate={{
            x: [0, 8, -6, 0],
            y: [0, -7, 5, 0],
            scale: [1, 1.02, 0.995, 1],
            rotate: [0, 0.8, -0.8, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="h-[560px] w-[560px] rounded-full blur-[145px] opacity-68"
            style={{ background: bg3 }}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute left-[50%] top-[-120px] -translate-x-1/2 will-change-transform"
        style={{ x: mounted ? mouseXWide : 0, y: mounted ? y4 : 0 }}
      >
        <motion.div
          animate={{
            x: [0, 6, -4, 0],
            y: [0, -4, 3, 0],
            scale: [1, 1.015, 0.998, 1],
          }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.div
            className="h-[420px] w-[960px] rounded-full blur-[135px] opacity-52"
            style={{ background: bg4 }}
          />
        </motion.div>
      </motion.div>

      <div className="hidden dark:block absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.05),rgba(255,255,255,0.018)_12%,rgba(0,0,0,0.10)_30%,rgba(0,0,0,0.48)_58%,rgba(0,0,0,0.88)_100%)]" />

      <div className="hidden dark:block absolute inset-x-0 top-0 h-[38vh] bg-gradient-to-b from-white/[0.03] via-white/[0.012] to-transparent" />

      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] mix-blend-multiply dark:mix-blend-soft-light"
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