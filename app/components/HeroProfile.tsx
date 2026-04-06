"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import OrbitScoreMeter from "./OrbitScoreMeter";
import type { SearchedProfile } from "../types";

interface HeroProfileProps {
  user: SearchedProfile;
}

function formatCount(n: number): string {
  if (n < 0) return "N/A";  // -1 sentinel = field absent from API response
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

export default function HeroProfile({ user }: HeroProfileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-30 flex flex-col items-center"
      id="hero-profile"
    >
      {/* Deep bloom behind entire panel */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute pointer-events-none"
        style={{
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(109,40,217,0.55) 0%, rgba(88,28,235,0.2) 45%, transparent 72%)",
          filter: "blur(50px)",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: -1,
        }}
      />

      {/* Glass panel */}
      <div
        className="relative flex flex-col items-center px-8 pt-9 pb-7 rounded-3xl"
        style={{
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.11) 0%, rgba(168,85,247,0.07) 50%, rgba(255,255,255,0.04) 100%)",
          backdropFilter: "blur(48px)",
          WebkitBackdropFilter: "blur(48px)",
          border: "1px solid rgba(168,85,247,0.3)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.06) inset, 0 3px 0 rgba(255,255,255,0.1) inset, 0 12px 80px rgba(0,0,0,0.7), 0 0 40px rgba(109,40,217,0.15)",
          width: 290,
        }}
      >
        {/* Reflective top edge */}
        <div
          className="absolute top-0 left-0 right-0 rounded-t-3xl h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 5%, rgba(220,180,255,0.7) 30%, rgba(255,255,255,0.5) 50%, rgba(220,180,255,0.7) 70%, transparent 95%)",
          }}
        />

        {/* Edge glow left */}
        <div
          className="absolute top-8 bottom-8 left-0 w-px rounded-full pointer-events-none"
          style={{ background: "linear-gradient(180deg, transparent, rgba(168,85,247,0.4), transparent)" }}
        />
        {/* Edge glow right */}
        <div
          className="absolute top-8 bottom-8 right-0 w-px rounded-full pointer-events-none"
          style={{ background: "linear-gradient(180deg, transparent, rgba(168,85,247,0.3), transparent)" }}
        />

        {/* ── AVATAR ── */}
        <div className="relative mb-4">
          {/* Rotating bright ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -6,
              background:
                "conic-gradient(from 0deg, rgba(168,85,247,0) 0%, rgba(192,132,252,0.9) 25%, rgba(255,255,255,0.6) 40%, rgba(192,132,252,0.9) 55%, rgba(168,85,247,0) 70%, rgba(99,102,241,0.7) 85%, rgba(168,85,247,0) 100%)",
              borderRadius: "50%",
              padding: 2,
            }}
          />

          {/* Static soft ring underneath */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -6,
              background: "rgba(0,0,0,0.5)",
              borderRadius: "50%",
              zIndex: -1,
            }}
          />

          {/* Outer pulse halo */}
          <motion.div
            animate={{ scale: [1, 1.22, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -14,
              border: "1.5px solid rgba(168,85,247,0.6)",
              borderRadius: "50%",
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
            className="absolute rounded-full pointer-events-none"
            style={{
              inset: -14,
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: "50%",
            }}
          />

          {/* Avatar image */}
          <div
            className="relative rounded-full overflow-hidden"
            style={{
              width: 84,
              height: 84,
              boxShadow: "0 0 0 2px rgba(0,0,0,0.6), 0 0 30px rgba(139,92,246,0.6)",
            }}
          >
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={user.displayName}
                width={84}
                height={84}
                className="rounded-full object-cover"
                unoptimized
              />
            ) : (
              /* Neutral placeholder when no avatar available */
              <div
                className="w-full h-full rounded-full flex items-center justify-center text-white/40 text-2xl font-black"
                style={{ background: "linear-gradient(135deg, #4c1d95, #1e1b4b)" }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Verified badge */}
          {user.verified && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                boxShadow: "0 0 10px rgba(124,58,237,0.8)",
                border: "1.5px solid rgba(0,0,0,0.5)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2 2L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>

        {/* Name */}
        <h1
          className="text-[22px] font-black text-white tracking-tight text-center leading-tight mb-0.5"
          style={{ textShadow: "0 0 40px rgba(192,132,252,0.6)" }}
        >
          {user.displayName}
        </h1>

        {/* Username */}
        <span className="text-xs text-purple-300/70 mb-3 tracking-wider font-medium">
          @{user.username}
        </span>

        {/* Bio */}
        <p className="text-[11px] text-white/40 text-center leading-relaxed mb-4 max-w-[210px]">
          {user.bio}
        </p>

        {/* Divider */}
        <div
          className="w-full h-px mb-4"
          style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.25), transparent)" }}
        />

        {/* Stats */}
        <div className="flex gap-2.5 mb-5 w-full justify-center">
          {[
            { label: "Followers", value: formatCount(user.followers) },
            { label: "Following", value: formatCount(user.following) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center px-3 py-2 rounded-xl flex-1"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.06))",
                border: "1px solid rgba(139,92,246,0.2)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.03) inset",
              }}
            >
              <span className="text-[15px] font-bold text-white leading-tight">{stat.value}</span>
              <span className="text-[9px] text-purple-300/50 uppercase tracking-widest mt-0.5">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Orbit Score Meter */}
        <OrbitScoreMeter score={user.score} />

        {/* Scanning label */}
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity }}
          className="mt-3 flex items-center gap-1.5 text-[9px] tracking-[0.2em] text-purple-300/50 uppercase"
        >
          <motion.span
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-1 rounded-full bg-purple-400"
            style={{ boxShadow: "0 0 6px rgba(168,85,247,1)" }}
          />
          Scanning Network
        </motion.div>
      </div>
    </motion.div>
  );
}
