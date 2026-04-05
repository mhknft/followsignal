"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import HeroProfile from "./HeroProfile";
import ResultCard from "./ResultCard";
import OrbitLines from "./OrbitLines";
import { getResults } from "../lib/getResults";
import type { PredictedAccount } from "../types";

interface Props {
  username?: string;
  predictions: PredictedAccount[] | null; // null = loading
  hasError?: boolean;
}

export default function ConstellationLayout({ username, predictions, hasError }: Props) {
  const { profile } = getResults(username ?? "alexrivera");

  const heroRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [connections, setConnections] = useState<
    { fromX: number; fromY: number; toX: number; toY: number; color: string }[]
  >([]);

  const isLoading = predictions === null;
  const isEmpty   = !isLoading && predictions.length === 0;
  const hasCards  = !isLoading && predictions.length > 0;

  const corners  = hasCards ? predictions.filter((a) => !a.isWildcard) : [];
  const wildcard = hasCards ? predictions.find((a) => a.isWildcard) ?? null : null;

  useEffect(() => {
    if (!hasCards) return;

    const updateConnections = () => {
      if (!heroRef.current) return;
      const heroRect = heroRef.current.getBoundingClientRect();
      const heroCX = heroRect.left + heroRect.width / 2;
      const heroCY = heroRect.top + heroRect.height / 2;

      const newConns = cardRefs.current
        .map((ref, i) => {
          if (!ref) return null;
          const rect = ref.getBoundingClientRect();
          return {
            fromX: heroCX,
            fromY: heroCY,
            toX: rect.left + rect.width / 2,
            toY: rect.top + rect.height / 2,
            color: predictions[i]?.isWildcard
              ? "rgba(168,85,247,0.5)"
              : "rgba(139,92,246,0.3)",
          };
        })
        .filter(Boolean) as { fromX: number; fromY: number; toX: number; toY: number; color: string }[];

      setConnections(newConns);
    };

    const t = setTimeout(updateConnections, 700);
    window.addEventListener("resize", updateConnections);
    window.addEventListener("scroll", updateConnections);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", updateConnections);
      window.removeEventListener("scroll", updateConnections);
    };
  }, [hasCards, predictions]);

  return (
    <>
      <OrbitLines connections={connections} />

      <div className="relative z-20 w-full" style={{ minHeight: "max(1100px, 140vh)" }}>

        {/* ── HERO CENTER ── */}
        <div
          ref={heroRef}
          className="absolute left-1/2 z-30"
          style={{ top: "28%", transform: "translate(-50%, -50%)" }}
        >
          <HeroProfile user={profile} />
        </div>

        {/* ── LOADING STATE ── */}
        {isLoading && (
          <div
            className="absolute left-1/2 z-20"
            style={{ top: "60%", transform: "translateX(-50%)" }}
          >
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full border-2 border-purple-500/40 border-t-purple-400 animate-spin" />
              <span className="text-[11px] tracking-[0.25em] uppercase text-purple-400/50">
                Scanning network…
              </span>
            </motion.div>
          </div>
        )}

        {/* ── EMPTY / ERROR STATE ── */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute left-1/2 z-20"
            style={{ top: "58%", transform: "translateX(-50%)" }}
          >
            <div
              className="flex flex-col items-center gap-4 px-8 py-7 rounded-2xl text-center"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(139,92,246,0.05) 100%)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid rgba(139,92,246,0.18)",
                maxWidth: 320,
              }}
            >
              <span className="text-3xl">🔭</span>
              <p className="text-sm font-semibold text-white/70">
                {hasError ? "Scan failed" : "No strong matches found"}
              </p>
              <p className="text-[11px] text-white/30 leading-relaxed">
                {hasError
                  ? "Couldn't reach the network. Check your connection and try again."
                  : "No stronger matches found above your current orbit score."}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── TOP-LEFT ── */}
        {corners[0] && (
          <div
            ref={(el) => { cardRefs.current[0] = el; }}
            className="absolute z-25"
            style={{ top: "5%", left: "clamp(12px, 6vw, 120px)" }}
          >
            <ResultCard account={corners[0]} index={0} />
          </div>
        )}

        {/* ── TOP-RIGHT ── */}
        {corners[1] && (
          <div
            ref={(el) => { cardRefs.current[1] = el; }}
            className="absolute z-25"
            style={{ top: "5%", right: "clamp(12px, 6vw, 120px)" }}
          >
            <ResultCard account={corners[1]} index={1} />
          </div>
        )}

        {/* ── LOWER-LEFT ── */}
        {corners[2] && (
          <div
            ref={(el) => { cardRefs.current[2] = el; }}
            className="absolute z-25"
            style={{ top: "56%", left: "clamp(12px, 4vw, 80px)" }}
          >
            <ResultCard account={corners[2]} index={2} />
          </div>
        )}

        {/* ── LOWER-RIGHT ── */}
        {corners[3] && (
          <div
            ref={(el) => { cardRefs.current[3] = el; }}
            className="absolute z-25"
            style={{ top: "56%", right: "clamp(12px, 4vw, 80px)" }}
          >
            <ResultCard account={corners[3]} index={3} />
          </div>
        )}

        {/* ── WILDCARD BOTTOM CENTER ── */}
        {wildcard && (
          <div
            ref={(el) => { cardRefs.current[4] = el; }}
            className="absolute z-35"
            style={{
              top: "72%",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <ResultCard account={wildcard} index={4} />
          </div>
        )}
      </div>
    </>
  );
}
