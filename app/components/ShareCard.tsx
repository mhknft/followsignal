"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { getResults } from "../lib/getResults";
import type { PredictedAccount } from "../types";

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function formatScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

interface ShareCardProps {
  username?: string;
  predictions: PredictedAccount[] | null;
}

export default function ShareCard({ username, predictions }: ShareCardProps) {
  const { profile } = getResults(username ?? "alexrivera");
  return (
    <section className="relative z-30 mt-24 mb-16 flex flex-col items-center px-6">
      {/* Section label */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="flex flex-col items-center mb-10"
      >
        <span
          className="text-[10px] tracking-[0.3em] uppercase text-purple-400/60 mb-3"
        >
          Share Your Results
        </span>
        <h2 className="text-2xl font-bold text-white text-center">
          Built to post directly on X
        </h2>
        <p className="text-sm text-white/40 mt-2 text-center max-w-sm">
          Your signal card is ready. One tap to download and share.
        </p>
      </motion.div>

      {/* Share card preview */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        {/* Frame glow */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.4) 0%, transparent 70%)",
            filter: "blur(30px)",
            transform: "scale(1.2)",
            zIndex: -1,
          }}
        />

        {/* Glass frame */}
        <div
          className="relative p-4 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(139,92,246,0.06) 100%)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(139,92,246,0.3)",
            boxShadow:
              "0 8px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset",
          }}
        >
          {/* The actual share card */}
          <div
            className="relative overflow-hidden rounded-xl"
            style={{
              width: 520,
              maxWidth: "100%",
              background:
                "linear-gradient(135deg, #0d0010 0%, #150025 40%, #0a001a 100%)",
            }}
          >
            {/* Share card background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 30%, rgba(109,40,217,0.35) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(79,70,229,0.2) 0%, transparent 50%)",
              }}
            />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                      boxShadow: "0 0 10px rgba(124,58,237,0.5)",
                    }}
                  />
                  <span
                    className="text-sm font-bold tracking-widest uppercase"
                    style={{
                      background: "linear-gradient(90deg, #c084fc, #818cf8)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    FollowSignal
                  </span>
                </div>
                <span className="text-[10px] text-white/30 tracking-widest uppercase">
                  AI Prediction
                </span>
              </div>

              {/* Analyzed user row */}
              <div
                className="flex items-center gap-3 mb-5 p-3 rounded-xl"
                style={{
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.2)",
                }}
              >
                <div
                  className="rounded-full overflow-hidden flex-shrink-0"
                  style={{
                    width: 40,
                    height: 40,
                    border: "2px solid rgba(168,85,247,0.5)",
                    boxShadow: "0 0 12px rgba(168,85,247,0.3)",
                  }}
                >
                  <Image
                    src={profile.avatar}
                    alt={profile.name}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{profile.name}</div>
                  <div className="text-xs text-purple-300/60">{profile.username}</div>
                </div>
                <div className="ml-auto text-right">
                  <div
                    className="text-lg font-black"
                    style={{
                      background: "linear-gradient(135deg, #c084fc, #818cf8)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {profile.orbitScore}
                  </div>
                  <div className="text-[9px] text-white/30 uppercase tracking-widest">
                    Orbit Score
                  </div>
                </div>
              </div>

              {/* Label */}
              <div className="text-[9px] uppercase tracking-[0.25em] text-purple-400/50 mb-3">
                Top Predicted Followers
              </div>

              {/* Account list — loading skeleton, empty state, or real rows */}
              {predictions === null ? (
                <div className="flex flex-col gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="w-4" />
                      <div className="w-7 h-7 rounded-full bg-white/5 flex-shrink-0" />
                      <div className="flex-1 flex flex-col gap-1">
                        <div className="h-2.5 rounded bg-white/[0.08] w-2/3" />
                        <div className="h-2 rounded bg-white/5 w-1/2" />
                      </div>
                      <div className="w-10 h-3 rounded bg-purple-500/15" />
                    </div>
                  ))}
                </div>
              ) : predictions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <span className="text-lg">🔭</span>
                  <p className="text-[10px] text-white/30 text-center tracking-wide">
                    No stronger matches found above your current orbit score
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {predictions.map((acc, i) => (
                    <div key={acc.id} className="flex items-center gap-3">
                      <span className="text-[10px] text-white/20 w-4 text-right flex-shrink-0">
                        {i + 1}
                      </span>
                      <div
                        className="rounded-full overflow-hidden flex-shrink-0"
                        style={{ width: 28, height: 28, border: "1px solid rgba(139,92,246,0.25)" }}
                      >
                        <Image
                          src={acc.avatar}
                          alt={acc.name}
                          width={28}
                          height={28}
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {acc.name}
                        </div>
                        <div className="text-[10px] text-white/30 truncate">
                          {acc.username} · {formatCount(acc.followers)} followers
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {acc.isWildcard && (
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded-full tracking-widest uppercase"
                            style={{
                              background: "rgba(168,85,247,0.25)",
                              border: "1px solid rgba(168,85,247,0.4)",
                              color: "rgba(220,180,255,0.9)",
                            }}
                          >
                            Rare
                          </span>
                        )}
                        <span
                          className="text-xs font-black"
                          style={{
                            background: "linear-gradient(135deg, #c084fc, #818cf8)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                          }}
                        >
                          {acc.score != null ? formatScore(acc.score) : `${acc.matchPercent}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: "1px solid rgba(139,92,246,0.1)" }}>
                <span className="text-[9px] text-white/20 tracking-widest uppercase">
                  AI Network Scan Complete
                </span>
                <span className="text-[9px] text-white/20 tracking-widest uppercase">
                  Powered by AI · {new Date().toLocaleDateString()}
                </span>
                <span
                  className="text-[8px] tracking-wide"
                  style={{ color: "rgba(180,155,230,0.38)" }}
                >
                  Built by @mhknft
                </span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Download button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.9 }}
        className="flex flex-col items-center gap-3"
      >
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="relative px-10 py-4 rounded-2xl font-bold text-sm tracking-wide text-white overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4f46e5 100%)",
            boxShadow:
              "0 0 0 1px rgba(168,85,247,0.3), 0 8px 32px rgba(109,40,217,0.4), 0 2px 0 rgba(255,255,255,0.1) inset",
          }}
        >
          {/* Button shine */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)",
            }}
          />
          <span className="relative flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1v9m0 0L5 7m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download Share Card
          </span>
        </motion.button>

        <p className="text-[11px] text-white/30 tracking-wide">
          Optimized for X · 1200 × 630px
        </p>
      </motion.div>
    </section>
  );
}
