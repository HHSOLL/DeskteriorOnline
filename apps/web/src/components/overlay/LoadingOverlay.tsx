"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

export function LoadingOverlay() {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const qaBypassEnabled =
      typeof window !== "undefined" &&
      ((window as Window & { __DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__?: boolean })
        .__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__ === true ||
        new URLSearchParams(window.location.search).get("qaNoLoader") === "1");
    if (qaBypassEnabled) {
      setProgress(100);
      setIsVisible(false);
      return;
    }

    // Safety timeout: ensure loader disappears after 5 seconds max
    const safetyTimer = setTimeout(() => {
      setIsVisible(false);
    }, 5000);

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          clearTimeout(safetyTimer);
          setTimeout(() => setIsVisible(false), 500);
          return 100;
        }
        const next = prev + Math.random() * 20;
        return next > 100 ? 100 : next;
      });
    }, 150);

    return () => {
      clearInterval(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.8, ease: "easeInOut" }}
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#fdfdfc] text-[#1a1a1a]"
        >
          <span className="sr-only">Loading DeskteriorOnline</span>
          <div className="relative w-48 h-[1px] overflow-hidden bg-black/5">
            <motion.div
              className="absolute inset-y-0 left-0 bg-black"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "easeOut", duration: reduceMotion ? 0 : 0.5 }}
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
            className="mt-12 text-4xl tracking-[0.1em] uppercase"
          >
            DeskteriorOnline
          </motion.div>
          <motion.div
            className="mt-4 text-[9px] tracking-[0.4em] text-black/20 uppercase font-bold"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: reduceMotion ? 0 : 2 }}
          >
            Architectural Engine
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
