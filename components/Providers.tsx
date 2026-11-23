"use client";

import React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { GlassBackground } from "./GlassBackground";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <GlassBackground />
      {children}
    </NextThemesProvider>
  );
}
