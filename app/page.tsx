"use client";

import { motion } from "framer-motion";
import Background from "./components/Background";
import ParticleField from "./components/ParticleField";
import ScanInput from "./components/ScanInput";

export default function Home() {
  return (
    <main className="relative min-h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      <Background />
      <ParticleField />

      {/* Nav logo only */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-7 py-5"
        style={{
          background: "linear-gradient(180deg, rgba(2,0,12,0.7) 0%, rgba(2,0,12,0) 100%)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ boxShadow: ["0 0 14px rgba(124,58,237,0.5)", "0 0 22px rgba(168,85,247,0.8)", "0 0 14px rgba(124,58,237,0.5)"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="2" fill="white" />
              <circle cx="7" cy="2" r="1.2" fill="rgba(255,255,255,0.75)" />
              <circle cx="7" cy="12" r="1.2" fill="rgba(255,255,255,0.75)" />
              <circle cx="2" cy="7" r="1.2" fill="rgba(255,255,255,0.75)" />
              <circle cx="12" cy="7" r="1.2" fill="rgba(255,255,255,0.75)" />
              <line x1="7" y1="5" x2="7" y2="3.2" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" />
              <line x1="7" y1="9" x2="7" y2="10.8" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" />
              <line x1="5" y1="7" x2="3.2" y2="7" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" />
              <line x1="9" y1="7" x2="10.8" y2="7" stroke="rgba(255,255,255,0.45)" strokeWidth="0.7" />
            </svg>
          </motion.div>
          <span
            className="text-base font-bold tracking-tight"
            style={{
              background: "linear-gradient(90deg, #f5f0ff, #d8b4fe, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            FollowSignal
          </span>
        </div>
      </motion.div>

      {/* Hero content */}
      <div className="relative z-20 flex flex-col items-center text-center px-6">

        {/* Status pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
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
          <span className="text-[10px] tracking-[0.2em] uppercase text-purple-300/60">
            AI Network Intelligence · Live
          </span>
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="font-black leading-none tracking-tight mb-4"
          style={{ fontSize: "clamp(36px, 6vw, 64px)" }}
        >
          <span className="text-white">Who will follow</span>
          <br />
          <span
            style={{
              background: "linear-gradient(135deg, #e879f9 0%, #c084fc 40%, #818cf8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(168,85,247,0.4))",
            }}
          >
            you next?
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="text-base leading-relaxed mb-10 max-w-sm"
          style={{ color: "rgba(180,150,230,0.5)" }}
        >
          Scan any X profile and reveal the 5 biggest accounts most likely to follow next — powered by AI signal mapping.
        </motion.p>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full"
        >
          <ScanInput />
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.8 }}
          className="mt-10 flex items-center gap-2 text-[10px] tracking-widest uppercase"
          style={{ color: "rgba(139,92,246,0.35)" }}
        >
          <span className="w-8 h-px" style={{ background: "rgba(139,92,246,0.25)" }} />
          5 accounts · 1 scan · instant results
          <span className="w-8 h-px" style={{ background: "rgba(139,92,246,0.25)" }} />
        </motion.div>
      </div>

      {/* Creator credit */}
      <div className="fixed bottom-5 right-6 z-50">
        <a
          href="https://x.com/mhknft"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 transition-all duration-300"
          style={{ textDecoration: "none" }}
        >
          <span className="text-[10px] tracking-wide" style={{ color: "rgba(180,160,220,0.62)" }}>
            Built by
          </span>
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
