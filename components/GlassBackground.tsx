"use client";

import React, { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";

export function GlassBackground() {
  const { backgroundStyle, glassIntensity, accent } = useSettingsStore();

  useEffect(() => {
    // Dynamically update root css variable for glass blur
    document.documentElement.style.setProperty("--glass-blur", `${glassIntensity}px`);
    document.documentElement.setAttribute("data-accent", accent);
  }, [glassIntensity, accent]);

  const isAnimated = backgroundStyle === "animated";

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 overflow-hidden pointer-events-none -z-10 select-none"
    >
      {/* Base gradient layer */}
      <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background" />

      {/* Floating orbs */}
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-500/20 dark:bg-blue-600/15 blur-3xl ${
          isAnimated ? "animate-orb-slow-1" : ""
        }`}
      />
      <div
        className={`absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-purple-500/20 dark:bg-purple-600/15 blur-3xl ${
          isAnimated ? "animate-orb-slow-2" : ""
        }`}
      />
      <div
        className={`absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-emerald-500/15 dark:bg-emerald-600/10 blur-3xl ${
          isAnimated ? "animate-orb-slow-3" : ""
        }`}
      />

      {/* Subtle glass mesh overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.1),rgba(255,255,255,0))]" />
    </div>
  );
}
