"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 rounded-xl glass-button flex items-center justify-center opacity-60" />
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <button
      onClick={cycleTheme}
      className="w-9 h-9 rounded-xl glass-button flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors relative"
      title={`Current theme: ${theme}. Click to switch.`}
      aria-label="Toggle theme"
    >
      {theme === "light" && <Sun className="w-4 h-4 text-amber-500" />}
      {theme === "dark" && <Moon className="w-4 h-4 text-blue-400" />}
      {theme === "system" && <Laptop className="w-4 h-4 text-slate-400" />}
    </button>
  );
}
