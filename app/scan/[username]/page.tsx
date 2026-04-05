"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Background from "../../components/Background";
import ParticleField from "../../components/ParticleField";
import OrbitalScanner from "../../components/OrbitalScanner";
import { generateDisplayName } from "../../data/generateProfile";
import type { SearchedProfile } from "../../types";

interface Props {
  params: Promise<{ username: string }>;
}

// Steps 0–4 are timer-driven; step 5 ("Finalizing…") is data-driven.
// Durations are calibrated so the progress bar naturally hits the user-visible
// stage percentages: 15 / 35 / 60 / 80 / 95 / 100.
const STEPS = [
  { label: "Profile identified",                duration: 800  }, // 0  → ~15 %
  { label: "Reading profile data",              duration: 1100 }, // 15 → ~35 %
  { label: "Mapping interaction graph",          duration: 1300 }, // 35 → ~60 %
  { label: "Checking larger accounts in orbit",  duration: 1100 }, // 60 → ~80 %
  { label: "Filtering follow-backs",             duration: 900  }, // 80 → ~95 %
  { label: "Finalizing recommendations",         duration: 600  }, // 95 → 100 % (data-driven)
];

// Sum of the five timed steps only (≈ 5 200 ms).
const TIMED_TOTAL = STEPS.slice(0, 5).reduce((s, x) => s + x.duration, 0);

// Absolute minimum scan duration in ms.  Even if the API is instant, the
// loading screen is shown for at least this long to feel believable (5 s).
const MIN_SCAN_MS = 5000;

export default function ScanPage({ params }: Props) {
  const { username } = use(params);
  const router = useRouter();

  const fallbackName = generateDisplayName(username);

  // Record the moment the component mounts so we can enforce MIN_SCAN_MS.
  const mountedAt = useRef(Date.now());

  const [profile,        setProfile]        = useState<SearchedProfile | null>(null);
  const [currentStep,    setCurrentStep]     = useState(0);
  const [completedSteps, setCompletedSteps]  = useState<number[]>([]);
  const [elapsed,        setElapsed]         = useState(0);
  const [dataReady,      setDataReady]       = useState(false);
  const [scanError,      setScanError]       = useState(false);

  // ── Profile fetch: fires immediately, resolves fast → avatar shows early ──────
  // Decoupled from the scan so the user sees the real face during the loading
  // animation without waiting for all 300 score lookups to complete.
  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}`)
      .then((r) => (r.ok ? (r.json() as Promise<SearchedProfile>) : Promise.reject()))
      .then((data) => setProfile(data))
      .catch(() => {}); // graceful: fallback name + no avatar shown
  }, [username]);

  // ── Scan fetch: drives navigation; enforces MIN_SCAN_MS floor ───────────────
  // If the API responds faster than MIN_SCAN_MS we hold the loading screen until
  // the minimum has elapsed, so the scan always feels substantive (≥ 5 s).
  useEffect(() => {
    fetch(`/api/scan/${encodeURIComponent(username)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`scan ${r.status}`);
        return r.json();
      })
      .then(() => {
        const elapsed  = Date.now() - mountedAt.current;
        const holdFor  = Math.max(0, MIN_SCAN_MS - elapsed);
        setTimeout(() => setDataReady(true), holdFor);
      })
      .catch(() => setScanError(true));
  }, [username]);

  // ── Step sequencer (steps 0–4, timer-based) ──────────────────────────────────
  // Step 5 ("Finalizing recommendations") is completed by the data effect below.
  useEffect(() => {
    if (scanError) return;
    let step = 0;

    const next = () => {
      if (step >= 5) return; // stop before step 5 — that one is data-driven
      const { duration } = STEPS[step];
      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, step]);
        step += 1;
        setCurrentStep(step);
        next();
      }, duration);
    };

    next();
  }, [scanError]);

  // ── Complete step 5 once data is ready AND steps 0–4 have finished ───────────
  useEffect(() => {
    if (!dataReady || currentStep < 5 || completedSteps.includes(5)) return;
    setCompletedSteps((prev) => [...prev, 5]);
    setCurrentStep(6);
  }, [dataReady, currentStep, completedSteps]);

  // ── Navigate as soon as step 5 is marked complete ────────────────────────────
  useEffect(() => {
    if (!completedSteps.includes(5) || scanError) return;
    const t = setTimeout(() => router.push(`/results/${username}`), 500);
    return () => clearTimeout(t);
  }, [completedSteps, scanError, username, router]);

  // ── Progress ticker (visual — tracks steps 0–3 timing) ───────────────────────
  useEffect(() => {
    if (scanError) return;
    const start = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(Math.min(ms, TIMED_TOTAL));
      if (ms >= TIMED_TOTAL) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [scanError]);

  // 0–95 % maps to the five timed steps; 100 % fires when step 5 (data-driven) completes.
  const progress = dataReady ? 1.0 : Math.min(elapsed / TIMED_TOTAL, 1) * 0.95;

  const displayName = profile?.displayName || fallbackName;
  const avatarUrl   = profile?.avatar       || null;

  // ── Error state ───────────────────────────────────────────────────────────────
  if (scanError) {
    return (
      <main className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
        <Background />
        <ParticleField />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-20 flex flex-col items-center text-center px-6 gap-6"
        >
          <span className="text-4xl">⚠️</span>
          <h1 className="text-xl font-bold text-white tracking-tight">Scan failed</h1>
          <p className="text-sm text-white/40 max-w-xs leading-relaxed">
            Could not reach the network for{" "}
            <span className="text-purple-300/70 font-semibold">@{username}</span>. Check your
            connection and try again.
          </p>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/")}
            className="px-7 py-3 rounded-xl text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
              boxShadow: "0 0 24px rgba(124,58,237,0.4), 0 2px 0 rgba(255,255,255,0.1) inset",
            }}
          >
            Try another account
          </motion.button>
        </motion.div>
      </main>
    );
  }

  // ── Normal loading screen ─────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      <Background />
      <ParticleField />

      {/* Navbar logo */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-7 py-5"
        style={{ background: "linear-gradient(180deg, rgba(2,0,12,0.7) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)", boxShadow: "0 0 14px rgba(124,58,237,0.5)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2" fill="white" />
              <circle cx="7" cy="2" r="1.2" fill="rgba(255,255,255,0.75)" />
              <circle cx="7" cy="12" r="1.2" fill="rgba(255,255,255,0.75)" />
              <circle cx="2" cy="7" r="1.2" fill="rgba(255,255,255,0.75)" />
              <circle cx="12" cy="7" r="1.2" fill="rgba(255,255,255,0.75)" />
            </svg>
          </div>
          <span className="text-base font-bold tracking-tight" style={{ background: "linear-gradient(90deg, #f5f0ff, #d8b4fe, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            FollowSignal
          </span>
        </div>
      </motion.div>

      {/* Main content */}
      <div className="relative z-20 flex flex-col items-center text-center px-6 gap-8">

        {/* Username scanning pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full"
          style={{
            background: "rgba(139,92,246,0.1)",
            border: "1px solid rgba(139,92,246,0.25)",
            backdropFilter: "blur(16px)",
          }}
        >
          <motion.span
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="w-1 h-1 rounded-full"
            style={{ background: "rgba(168,85,247,1)", boxShadow: "0 0 6px rgba(168,85,247,1)" }}
          />
          <span className="text-[11px] tracking-[0.2em] uppercase text-purple-300/70">
            Scanning{" "}
            <span className="text-purple-200 font-semibold">@{username}</span>
          </span>
        </motion.div>

        {/* Orbital scanner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <OrbitalScanner avatarUrl={avatarUrl} displayName={displayName} />
        </motion.div>

        {/* Display name + handle */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-col items-center gap-1"
        >
          <h1 className="text-2xl font-black text-white tracking-tight">
            {displayName}
          </h1>
          <span className="text-sm text-purple-300/50 tracking-wide">@{username}</span>
        </motion.div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="w-full max-w-xs"
        >
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 3, background: "rgba(139,92,246,0.12)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #6d28d9, #a855f7, #e879f9)",
                boxShadow: "0 0 10px rgba(168,85,247,0.6)",
                transition: "width 0.15s linear",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] tracking-widest uppercase text-white/20">
              Orbit Analysis
            </span>
            <span className="text-[10px] tracking-widest text-purple-300/40">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </motion.div>

        {/* Step list */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="flex flex-col gap-2.5 w-full max-w-xs"
        >
          {STEPS.map((step, i) => {
            const done   = completedSteps.includes(i);
            const active = currentStep === i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i <= currentStep + 1 ? 1 : 0.15, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="flex items-center gap-3"
              >
                {/* Status icon */}
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {done ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                        boxShadow: "0 0 8px rgba(168,85,247,0.5)",
                      }}
                    >
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  ) : active ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-3.5 h-3.5 rounded-full border-2"
                      style={{ borderColor: "rgba(168,85,247,0.25)", borderTopColor: "rgba(192,132,252,0.9)" }}
                    />
                  ) : (
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: "rgba(139,92,246,0.2)" }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className="text-[12px] tracking-wide transition-colors duration-300"
                  style={{
                    color: done
                      ? "rgba(192,132,252,0.8)"
                      : active
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.2)",
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {step.label}
                </span>

                {/* Active shimmer */}
                {active && (
                  <motion.div
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    className="ml-auto flex-shrink-0"
                  >
                    <span className="text-[9px] tracking-widest uppercase text-purple-400/50">
                      running
                    </span>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* Done state */}
        <AnimatePresence>
          {completedSteps.length === STEPS.length && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-[11px] tracking-widest uppercase"
              style={{ color: "rgba(192,132,252,0.7)" }}
            >
              <motion.span
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "rgba(168,85,247,1)", boxShadow: "0 0 8px rgba(168,85,247,1)" }}
              />
              Analysis complete · Loading results
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Creator credit */}
      <div className="fixed bottom-5 right-6 z-50">
        <a
          href="https://x.com/mhknft"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5"
          style={{ textDecoration: "none" }}
        >
          <span className="text-[10px] tracking-wide" style={{ color: "rgba(180,160,220,0.62)" }}>Built by</span>
          <span
            className="text-[10px] font-medium tracking-wide transition-all duration-300 group-hover:translate-y-[-2px] group-hover:text-purple-300 group-hover:[text-shadow:0_0_10px_rgba(168,85,247,0.6)] inline-block"
            style={{ color: "rgba(192,168,240,0.65)" }}
          >
            @mhknft
          </span>
        </a>
      </div>
    </main>
  );
}
