"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Background from "../../components/Background";
import ParticleField from "../../components/ParticleField";
import OrbitalScanner from "../../components/OrbitalScanner";
import { generateDisplayName } from "../../data/generateProfile";

interface Props {
  params: Promise<{ username: string }>;
}

interface RealProfile {
  name: string | null;
  username: string;
  avatar: string | null;
}

const STEPS = [
  { label: "Reading profile data",             duration: 700  },
  { label: "Mapping interaction graph",         duration: 900  },
  { label: "Checking larger accounts in orbit", duration: 1000 },
  { label: "Filtering existing followers",      duration: 800  },
  { label: "Scoring realistic matches",         duration: 900  },
];

const TOTAL = STEPS.reduce((s, x) => s + x.duration, 0); // ~4 400 ms

export default function ScanPage({ params }: Props) {
  const { username } = use(params);
  const router = useRouter();

  // Fallback display name while real profile loads
  const fallbackName = generateDisplayName(username);

  const [profile, setProfile] = useState<RealProfile | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [elapsed, setElapsed] = useState(0);

  // Fetch real profile immediately — replaces fallback as soon as it arrives
  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}`)
      .then((r) => r.json())
      .then((data: RealProfile) => setProfile(data))
      .catch(() => {/* keep fallback */});
  }, [username]);

  // Step sequencer
  useEffect(() => {
    let step = 0;

    const next = () => {
      if (step >= STEPS.length) return;
      const { duration } = STEPS[step];
      setTimeout(() => {
        setCompletedSteps((prev) => [...prev, step]);
        step += 1;
        setCurrentStep(step);
        next();
      }, duration);
    };

    next();
  }, []);

  // Progress ticker
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(Math.min(ms, TOTAL));
      if (ms >= TOTAL) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, []);

  // Navigate after all steps complete
  useEffect(() => {
    if (completedSteps.length === STEPS.length) {
      const t = setTimeout(() => router.push(`/results/${username}`), 400);
      return () => clearTimeout(t);
    }
  }, [completedSteps, username, router]);

  const progress = Math.min(elapsed / TOTAL, 1);

  // Use real data if available, fall back to generated name + no avatar
  const displayName = profile?.name || fallbackName;
  const avatarUrl   = profile?.avatar || null;

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

        {/* Orbital scanner — avatar lives inside at the center */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <OrbitalScanner avatarUrl={avatarUrl} displayName={displayName} />
        </motion.div>

        {/* Display name + handle below the scanner */}
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
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #6d28d9, #a855f7, #e879f9)",
                boxShadow: "0 0 10px rgba(168,85,247,0.6)",
                transition: "width 0.1s linear",
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
