"use client";

import { useEffect, useRef, useState } from "react";
import HeroProfile from "./HeroProfile";
import ResultCard from "./ResultCard";
import OrbitLines from "./OrbitLines";
import { getResults } from "../lib/getResults";

export default function ConstellationLayout({ username }: { username?: string }) {
  const { profile, predictions } = getResults(username ?? "alexrivera");
  const heroRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [connections, setConnections] = useState<
    { fromX: number; fromY: number; toX: number; toY: number; color: string }[]
  >([]);

  useEffect(() => {
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
  }, []);

  const corners = predictions.filter((a) => !a.isWildcard);
  const wildcard = predictions.find((a) => a.isWildcard)!;

  return (
    <>
      <OrbitLines connections={connections} />

      {/*
        Outer wrapper: full-width, tall enough to hold the constellation.
        Uses CSS grid-like approach with viewport units so it scales.
      */}
      <div
        className="relative z-20 w-full"
        style={{ minHeight: "max(1100px, 140vh)" }}
      >
        {/* ── HERO CENTER ── */}
        <div
          ref={heroRef}
          className="absolute left-1/2 z-30"
          style={{ top: "28%", transform: "translate(-50%, -50%)" }}
        >
          <HeroProfile user={profile} />
        </div>

        {/* ── TOP-LEFT ── */}
        <div
          ref={(el) => { cardRefs.current[0] = el; }}
          className="absolute z-25"
          style={{ top: "5%", left: "clamp(12px, 6vw, 120px)" }}
        >
          <ResultCard account={corners[0]} index={0} />
        </div>

        {/* ── TOP-RIGHT ── */}
        <div
          ref={(el) => { cardRefs.current[1] = el; }}
          className="absolute z-25"
          style={{ top: "5%", right: "clamp(12px, 6vw, 120px)" }}
        >
          <ResultCard account={corners[1]} index={1} />
        </div>

        {/* ── LOWER-LEFT ── */}
        <div
          ref={(el) => { cardRefs.current[2] = el; }}
          className="absolute z-25"
          style={{ top: "56%", left: "clamp(12px, 4vw, 80px)" }}
        >
          <ResultCard account={corners[2]} index={2} />
        </div>

        {/* ── LOWER-RIGHT ── */}
        <div
          ref={(el) => { cardRefs.current[3] = el; }}
          className="absolute z-25"
          style={{ top: "56%", right: "clamp(12px, 4vw, 80px)" }}
        >
          <ResultCard account={corners[3]} index={3} />
        </div>

        {/* ── WILDCARD BOTTOM CENTER ── */}
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
      </div>
    </>
  );
}
