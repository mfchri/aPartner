"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Eye, EyeOff, ShieldAlert, Sparkles, ArrowRight } from "lucide-react";

interface PasscodeGateProps {
  onSuccess: () => void;
  setupError?: string | null;
}

export function PasscodeGate({ onSuccess, setupError }: PasscodeGateProps) {
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed.");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else {
        onSuccess();
      }
    } catch {
      setError("Network error. Could not connect to the server.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={
          shake
            ? { x: [-12, 12, -8, 8, -4, 4, 0], opacity: 1, scale: 1, y: 0 }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={{ type: "spring", damping: 22, stiffness: 320 }}
        className="w-full max-w-md glass-panel rounded-3xl p-8 relative overflow-hidden shadow-2xl"
      >
        {/* Animated Glow accents */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1],
            x: [0, 15, 0],
            y: [0, -15, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/25 rounded-full blur-2xl pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -20, 0],
            y: [0, 20, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/25 rounded-full blur-2xl pointer-events-none"
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Icon Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 450, damping: 25 }}
            className="w-16 h-16 rounded-2xl glass-button flex items-center justify-center mb-5 text-blue-500 shadow-md"
          >
            {setupError ? (
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            ) : (
              <Lock className="w-8 h-8" />
            )}
          </motion.div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-3 border border-blue-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Private Glass Chat</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            {setupError ? "Configuration Required" : "Enter Passcode"}
          </h1>

          <p className="text-sm text-muted-foreground text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
            {setupError
              ? setupError
              : "This private AI assistant is protected. Please enter your passcode to continue."}
          </p>

          {setupError ? (
            <div className="w-full text-left p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs leading-relaxed space-y-2">
              <p className="font-semibold">Setup instructions:</p>
              <p>
                In production, ensure your application passcode and Gemini API key are configured in your deployment environment variables (e.g. Vercel Project Settings &gt; Environment Variables).
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-4">
              <div className="relative">
                <input
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter passcode..."
                  required
                  autoFocus
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-2xl glass-input text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-blue-500/50 pr-12 text-center text-lg tracking-wider"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground transition-colors p-1"
                  aria-label={showPasscode ? "Hide passcode" : "Show passcode"}
                >
                  {showPasscode ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </motion.button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                type="submit"
                disabled={loading || !passcode.trim()}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Unlock Chat</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>
          )}

          <div className="mt-8 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            <span>Client-side private storage &bull; Gemini Flash</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
