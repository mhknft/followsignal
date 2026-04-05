"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const USERNAME_RE = /^[a-zA-Z0-9_]{1,15}$/;

function validate(raw: string): string | null {
  const clean = raw.trim().replace(/^@/, "");
  if (!clean) return null; // no error shown when empty
  if (!/^[a-zA-Z0-9_]+$/.test(clean))
    return "Only letters, numbers, and underscores are allowed.";
  if (clean.length > 15) return "Username must be 15 characters or fewer.";
  return null; // valid
}

export default function ScanInput() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const clean = value.trim().replace(/^@/, "");
  const isReady = USERNAME_RE.test(clean) && !scanning;

  const handleChange = (raw: string) => {
    // Strip a leading @ if the user types or pastes it
    const stripped = raw.replace(/^@/, "");
    setValue(stripped);
    if (error) setError(null);
  };

  const handleAnalyze = () => {
    if (scanning) return;
    const err = validate(value);
    if (err) { setError(err); return; }
    if (!clean) return;

    setError(null);
    setScanning(true);
    setTimeout(() => router.push(`/scan/${clean}`), 800);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAnalyze();
  };

  const hasError = !!error;

  return (
    <div className="flex flex-col items-center w-full max-w-lg px-6">
      {/* ── Input field ── */}
      <motion.div
        animate={
          hasError
            ? { boxShadow: "0 0 0 1px rgba(248,113,113,0.5), 0 0 24px rgba(248,113,113,0.12), 0 8px 32px rgba(0,0,0,0.5)" }
            : focused
            ? { boxShadow: "0 0 0 1px rgba(168,85,247,0.55), 0 0 40px rgba(139,92,246,0.22), 0 8px 40px rgba(0,0,0,0.5)" }
            : { boxShadow: "0 0 0 1px rgba(139,92,246,0.2), 0 8px 32px rgba(0,0,0,0.4)" }
        }
        transition={{ duration: 0.25 }}
        className="relative w-full rounded-2xl mb-2 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(139,92,246,0.06) 100%)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          border: `1px solid ${hasError ? "rgba(248,113,113,0.4)" : focused ? "rgba(168,85,247,0.45)" : "rgba(139,92,246,0.2)"}`,
          transition: "border-color 0.25s",
        }}
      >
        {/* Top edge highlight */}
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(200,160,255,0.4), transparent)" }}
        />

        <div className="flex items-center px-5 py-4 gap-3">
          {/* @ prefix */}
          <span
            className="text-lg font-semibold flex-shrink-0 transition-colors duration-200"
            style={{
              color: hasError
                ? "rgba(248,113,113,0.7)"
                : focused
                ? "rgba(192,132,252,0.9)"
                : "rgba(139,92,246,0.5)",
            }}
          >
            @
          </span>

          <input
            type="text"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder="username"
            disabled={scanning}
            maxLength={16}
            className="flex-1 bg-transparent text-white placeholder-white/20 text-base font-medium outline-none tracking-wide"
            style={{ caretColor: "rgba(192,132,252,0.9)" }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />

          {/* Clear button */}
          <AnimatePresence>
            {value && !scanning && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
                onClick={() => { setValue(""); setError(null); }}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-white/10"
                style={{ color: "rgba(139,92,246,0.5)" }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Validation error ── */}
      <AnimatePresence>
        {error && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="w-full mb-3 text-[11px] tracking-wide px-1"
            style={{ color: "rgba(248,113,113,0.75)" }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Spacer when no error ── */}
      {!error && <div className="mb-2" />}

      {/* ── Analyze button ── */}
      <motion.button
        onClick={handleAnalyze}
        disabled={!clean || scanning}
        whileHover={isReady ? { scale: 1.03 } : {}}
        whileTap={isReady ? { scale: 0.97 } : {}}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="relative w-full py-4 rounded-2xl font-bold text-sm tracking-widest uppercase text-white overflow-hidden group"
        style={{
          background: isReady
            ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4f46e5 100%)"
            : "linear-gradient(135deg, rgba(109,40,217,0.3) 0%, rgba(79,70,229,0.2) 100%)",
          boxShadow: isReady
            ? "0 0 0 1px rgba(168,85,247,0.4), 0 8px 40px rgba(109,40,217,0.45), 0 2px 0 rgba(255,255,255,0.1) inset"
            : "0 0 0 1px rgba(139,92,246,0.15)",
          cursor: isReady ? "pointer" : !clean ? "not-allowed" : "pointer",
          transition: "background 0.3s, box-shadow 0.3s",
        }}
      >
        {/* Shimmer on hover */}
        {isReady && (
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
            style={{ background: "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)" }}
          />
        )}
        {/* Top highlight */}
        <div
          className="absolute top-0 left-4 right-4 h-px rounded-full pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)" }}
        />

        <AnimatePresence mode="wait">
          {scanning ? (
            <motion.span
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center gap-3"
            >
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white inline-block flex-shrink-0"
              />
              Scanning {clean}…
            </motion.span>
          ) : (
            <motion.span
              key="analyze"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" />
                <circle cx="7" cy="7" r="2" fill="white" />
                <path d="M7 1.5v1.2M7 11.3v1.2M1.5 7h1.2M11.3 7h1.2" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round" />
              </svg>
              Analyze Profile
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* ── Helper text ── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4 text-[11px] tracking-wide text-center"
        style={{ color: "rgba(160,130,210,0.4)" }}
      >
        Enter any public X username · letters, numbers, underscores only
      </motion.p>
    </div>
  );
}
