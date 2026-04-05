"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { PredictedAccount } from "../types";

interface ResultCardProps {
  account: PredictedAccount;
  index: number;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

/** Format a raw Sorsa score for card display: 2400 → "2.4K", 850 → "850" */
function formatScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000)      return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

// Unique purple-family accent per card index
const cardAccents = [
  { primary: "rgba(139,92,246,",  glow: "rgba(139,92,246,",   border: "rgba(139,92,246,0.28)",  barFrom: "#6d28d9", barTo: "#a855f7" },
  { primary: "rgba(124,58,237,",  glow: "rgba(124,58,237,",   border: "rgba(124,58,237,0.28)",  barFrom: "#5b21b6", barTo: "#9333ea" },
  { primary: "rgba(99,102,241,",  glow: "rgba(99,102,241,",   border: "rgba(99,102,241,0.28)",  barFrom: "#4338ca", barTo: "#818cf8" },
  { primary: "rgba(109,40,217,",  glow: "rgba(109,40,217,",   border: "rgba(109,40,217,0.28)",  barFrom: "#581c87", barTo: "#a855f7" },
  { primary: "rgba(168,85,247,",  glow: "rgba(168,85,247,",   border: "rgba(168,85,247,0.45)",  barFrom: "#7c3aed", barTo: "#e879f9" },
];

const positionStyles: Record<
  string,
  { delay: number; rotate: number; floatY: number[]; floatDuration: number }
> = {
  "top-left":      { delay: 0.2,  rotate: -2,   floatY: [-5, 5, -5],   floatDuration: 5.8 },
  "top-right":     { delay: 0.35, rotate:  2,   floatY: [4, -6, 4],    floatDuration: 6.2 },
  "lower-left":    { delay: 0.5,  rotate: -1.5, floatY: [-4, 6, -4],   floatDuration: 7.0 },
  "lower-right":   { delay: 0.65, rotate:  1.5, floatY: [6, -4, 6],    floatDuration: 5.4 },
  "bottom-center": { delay: 0.8,  rotate:  0,   floatY: [-6, 6, -6],   floatDuration: 6.8 },
};

export default function ResultCard({ account, index }: ResultCardProps) {
  const pos = positionStyles[account.position] ?? positionStyles["top-left"];
  const accent = cardAccents[index] ?? cardAccents[0];
  const isWildcard = account.isWildcard;
  const cardWidth = isWildcard ? 248 : 200;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.88 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.0, delay: pos.delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ rotate: pos.rotate }}
      className="relative"
    >
      <motion.div
        animate={{ y: pos.floatY }}
        transition={{ duration: pos.floatDuration, repeat: Infinity, ease: "easeInOut" }}
        className="relative group"
        whileHover={{ scale: 1.05, rotate: 0, zIndex: 60 }}
        style={{ zIndex: isWildcard ? 35 : 25 }}
      >
        {/* ── Shadow / glow bloom beneath card ── */}
        <motion.div
          animate={isWildcard
            ? { opacity: [0.5, 0.9, 0.5], scale: [1, 1.06, 1] }
            : { opacity: [0.3, 0.55, 0.3] }
          }
          transition={{ duration: isWildcard ? 2.8 : 4, repeat: Infinity }}
          className="absolute pointer-events-none"
          style={{
            inset: -20,
            borderRadius: "50%",
            background: isWildcard
              ? `radial-gradient(ellipse at 50% 60%, ${accent.primary}0.55) 0%, transparent 65%)`
              : `radial-gradient(ellipse at 50% 80%, ${accent.primary}0.3) 0%, transparent 65%)`,
            filter: `blur(${isWildcard ? 24 : 18}px)`,
            zIndex: -1,
          }}
        />

        {/* ── Glass card ── */}
        <div
          className="relative flex flex-col rounded-2xl overflow-hidden transition-shadow duration-400 group-hover:shadow-2xl"
          style={{
            width: cardWidth,
            background: isWildcard
              ? `linear-gradient(160deg, rgba(255,255,255,0.13) 0%, ${accent.primary}0.12) 45%, rgba(255,255,255,0.05) 100%)`
              : `linear-gradient(160deg, rgba(255,255,255,0.09) 0%, ${accent.primary}0.07) 50%, rgba(255,255,255,0.03) 100%)`,
            backdropFilter: "blur(36px)",
            WebkitBackdropFilter: "blur(36px)",
            border: `1px solid ${accent.border}`,
            boxShadow: isWildcard
              ? `0 0 0 1px rgba(255,255,255,0.08) inset, 0 3px 0 rgba(255,255,255,0.12) inset, 0 8px 50px rgba(0,0,0,0.55), 0 0 30px ${accent.primary}0.18)`
              : `0 0 0 1px rgba(255,255,255,0.05) inset, 0 2px 0 rgba(255,255,255,0.08) inset, 0 6px 36px rgba(0,0,0,0.5)`,
            padding: isWildcard ? "20px 18px 20px" : "16px 14px 18px",
          }}
        >
          {/* Top reflective highlight */}
          <div
            className="absolute top-0 left-2 right-2 h-px rounded-full"
            style={{
              background: isWildcard
                ? "linear-gradient(90deg, transparent, rgba(220,180,255,0.8), rgba(255,255,255,0.5), rgba(220,180,255,0.8), transparent)"
                : "linear-gradient(90deg, transparent, rgba(200,160,255,0.5), transparent)",
            }}
          />

          {/* Left edge glow */}
          <div
            className="absolute top-6 bottom-6 left-0 w-px"
            style={{
              background: `linear-gradient(180deg, transparent, ${accent.primary}0.5), transparent)`,
            }}
          />

          {/* ── Category + status badges ── */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full font-semibold"
              style={{
                background: `${accent.primary}0.2)`,
                border: `1px solid ${accent.primary}0.35)`,
                color: "rgba(210,170,255,0.9)",
              }}
            >
              {account.category}
            </span>

            {isWildcard ? (
              <motion.span
                animate={{ boxShadow: [`0 0 6px ${accent.primary}0.4)`, `0 0 14px ${accent.primary}0.8)`, `0 0 6px ${accent.primary}0.4)`] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-full font-black"
                style={{
                  background: `linear-gradient(135deg, ${accent.primary}0.45), rgba(99,102,241,0.35))`,
                  border: `1px solid ${accent.primary}0.55)`,
                  color: "rgba(240,210,255,0.98)",
                }}
              >
                Rare Pick
              </motion.span>
            ) : (
              <span
                className="text-[9px] uppercase px-2 py-0.5 rounded-full tracking-wide"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(160,140,200,0.45)",
                }}
              >
                Not following
              </span>
            )}
          </div>

          {/* ── Avatar + identity ── */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="relative rounded-full overflow-hidden flex-shrink-0"
              style={{
                width: isWildcard ? 56 : 48,
                height: isWildcard ? 56 : 48,
                border: `1.5px solid ${accent.primary}0.4)`,
                boxShadow: `0 0 ${isWildcard ? 22 : 14}px ${accent.primary}0.45), 0 0 0 1px rgba(0,0,0,0.3) inset`,
              }}
            >
              <Image
                src={account.avatar}
                alt={account.name}
                width={isWildcard ? 56 : 48}
                height={isWildcard ? 56 : 48}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col min-w-0">
              <span
                className="font-bold text-white leading-tight truncate"
                style={{ fontSize: isWildcard ? 14 : 13 }}
              >
                {account.name}
              </span>
              <span className="text-[11px] text-purple-300/60 truncate">
                {account.username}
              </span>
              <span className="text-[10px] text-white/28 mt-0.5">
                {formatCount(account.followers)} followers
              </span>
            </div>
          </div>

          {/* ── Score / Match percentage ── */}
          <div className="flex items-end justify-between mb-3">
            <div className="flex flex-col">
              <span className="text-[9px] text-white/25 uppercase tracking-widest mb-0.5">
                {account.score != null ? "Score" : "Match"}
              </span>
              <motion.span
                className="font-black leading-none"
                style={{
                  fontSize: isWildcard ? 48 : 42,
                  background: isWildcard
                    ? `linear-gradient(135deg, #f0abfc, #c084fc, ${accent.barTo})`
                    : `linear-gradient(135deg, #c084fc, ${accent.barTo})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: `drop-shadow(0 0 ${isWildcard ? 14 : 8}px ${accent.primary}0.55))`,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: pos.delay + 0.5 }}
              >
                {account.score != null ? formatScore(account.score) : `${account.matchPercent}%`}
              </motion.span>
            </div>

            {isWildcard && (
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 8, 0, -8, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="text-3xl pb-1"
              >
                ⚡
              </motion.div>
            )}
          </div>

          {/* ── Match bar ── */}
          <div
            className="w-full rounded-full overflow-hidden mb-3"
            style={{
              height: isWildcard ? 5 : 3.5,
              background: `${accent.primary}0.1)`,
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${account.matchPercent}%` }}
              transition={{ duration: 1.4, delay: pos.delay + 0.6, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accent.barFrom}, ${accent.barTo})`,
                boxShadow: `0 0 10px ${accent.primary}0.7)`,
              }}
            />
          </div>

          {/* ── Reason text ── */}
          <p
            className="leading-relaxed text-white/35"
            style={{ fontSize: isWildcard ? 11 : 10 }}
          >
            {account.reason}
          </p>

          {/* Wildcard bottom accent line */}
          {isWildcard && (
            <div
              className="absolute bottom-0 left-2 right-2 h-px rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${accent.primary}0.6), transparent)`,
              }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
