"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={cycleTheme}
      className="w-9 h-9 rounded-xl glass-button flex items-center justify-center text-foreground/80 hover:text-foreground relative overflow-hidden"
      title={`Current theme: ${theme}. Click to switch.`}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-center"
        >
          {theme === "light" && <Sun className="w-4 h-4 text-amber-500" />}
          {theme === "dark" && <Moon className="w-4 h-4 text-blue-400" />}
          {theme === "system" && <Laptop className="w-4 h-4 text-slate-400" />}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
