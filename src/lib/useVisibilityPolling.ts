"use client";

import { useEffect, useRef } from "react";

/**
 * Custom hook to run a callback on an interval, 
 * but only when the tab is visible.
 */
export function useVisibilityPolling(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay !== null) {
      const tick = () => {
        if (document.visibilityState === "visible") {
          savedCallback.current();
        }
      };

      const id = setInterval(tick, delay);
      
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          savedCallback.current();
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);
      
      return () => {
        clearInterval(id);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [delay]);
}
