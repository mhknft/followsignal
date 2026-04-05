"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-7 py-4"
      style={{
        background: "linear-gradient(180deg, rgba(2,0,12,0.7) 0%, rgba(2,0,12,0) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* ── Logo → home ── */}
      <Link href="/" style={{ textDecoration: "none" }}>
        <div className="flex items-center gap-2.5 cursor-pointer">
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
      </Link>

      {/* ── Right side ── */}
      <div className="flex items-center gap-5">
        {/* Live indicator */}
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.8, repeat: Infinity }}
          className="hidden md:flex items-center gap-2 text-[11px] tracking-widest text-purple-300/50 uppercase"
        >
          <motion.span
            animate={{ scale: [1, 1.6, 1], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
            className="w-1 h-1 rounded-full"
            style={{ background: "rgba(168,85,247,1)", boxShadow: "0 0 8px rgba(168,85,247,1)" }}
          />
          AI Active
        </motion.div>

        {/* Luxury glass button → "/" */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <motion.div
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 0 1px rgba(168,85,247,0.5), 0 0 0 1px rgba(255,255,255,0.07) inset, 0 2px 0 rgba(255,255,255,0.08) inset, 0 6px 28px rgba(0,0,0,0.45), 0 0 28px rgba(139,92,246,0.28)",
            }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative overflow-hidden group px-5 py-2.5 rounded-xl text-[11px] font-semibold text-white tracking-widest uppercase cursor-pointer"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(139,92,246,0.15) 50%, rgba(255,255,255,0.06) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(168,85,247,0.35)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 2px 0 rgba(255,255,255,0.08) inset, 0 4px 20px rgba(0,0,0,0.4), 0 0 16px rgba(139,92,246,0.12)",
            }}
          >
            {/* Shimmer sweep on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.12) 50%, transparent 80%)" }}
            />
            {/* Top edge highlight */}
            <div
              className="absolute top-0 left-2 right-2 h-px rounded-full pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
            />
            <span className="relative flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="2" stroke="rgba(192,132,252,0.8)" strokeWidth="1.5" />
                <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11" stroke="rgba(192,132,252,0.6)" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Scan Profile
            </span>
          </motion.div>
        </Link>
      </div>
    </motion.nav>
  );
}
