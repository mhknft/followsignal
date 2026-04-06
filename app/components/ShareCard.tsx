"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { PredictedAccount, SearchedProfile } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

// Tag accent colours — partial-match on category string (case-insensitive)
function tagAccent(cat: string): { bg: string; border: string; color: string } {
  const c = cat.toLowerCase();
  if (c.includes("best"))
    return {
      bg:     "linear-gradient(90deg,rgba(192,132,252,0.22),rgba(245,158,11,0.14))",
      border: "1px solid rgba(210,155,255,0.58)",
      color:  "rgba(242,174,255,0.97)",
    };
  if (c.includes("near"))
    return {
      bg:     "rgba(168,85,247,0.22)",
      border: "1px solid rgba(168,85,247,0.54)",
      color:  "rgba(216,180,254,0.96)",
    };
  if (c.includes("strong"))
    return {
      bg:     "rgba(99,102,241,0.22)",
      border: "1px solid rgba(99,102,241,0.52)",
      color:  "rgba(165,180,252,0.96)",
    };
  if (c.includes("potential") || c.includes("high"))
    return {
      bg:     "rgba(236,72,153,0.18)",
      border: "1px solid rgba(236,72,153,0.48)",
      color:  "rgba(249,168,212,0.96)",
    };
  if (c.includes("watch"))
    return {
      bg:     "rgba(100,100,140,0.18)",
      border: "1px solid rgba(155,148,200,0.34)",
      color:  "rgba(188,184,226,0.78)",
    };
  // fallback
  return {
    bg:     "rgba(139,92,246,0.2)",
    border: "1px solid rgba(139,92,246,0.46)",
    color:  "rgba(200,172,255,0.92)",
  };
}

// ─── Card layout ──────────────────────────────────────────────────────────────
// Rendered 600 × 360 px → html-to-image exports at ×2 → 1 200 × 720 px.

const CARD_W = 600;
const CARD_H = 360;
const CX     = 300;

// Centre profile
const CY_PROFILE    = 74;
const CENTER_SIZE   = 82;   // conic ring container
const CENTER_AVATAR = 68;   // inner avatar diameter

// Bezier source: bottom of profile block
const LINE_SRC_Y = 160;

// Row 1 — 2 strongest (Card 0 is elevated 7 px above Row-1 baseline of y=229)
const ROW1_BASELINE = 229;
const ROW2_Y        = 301;

// Card centres [x, y]
const CARD_POS = [
  { x: 204, y: ROW1_BASELINE - 7 },   // 0 — Best Match (elevated)
  { x: 396, y: ROW1_BASELINE     },   // 1
  { x: 132, y: ROW2_Y            },   // 2
  { x: 300, y: ROW2_Y            },   // 3
  { x: 468, y: ROW2_Y            },   // 4 — most subtle
];

// Per-card visual config indexed by 0–4
const CARD_CFG = [
  // 0 — Best Match  (w=182, h=84)
  {
    w: 182, h: 84, avatarSz: 32, nameSz: 9.5, scoreSz: 13, tagSz: 6.5,
    border: "1px solid rgba(200,140,255,0.75)",
    bg:     "linear-gradient(155deg,rgba(100,35,185,0.5) 0%,rgba(16,6,44,0.72) 100%)",
    shadow: [
      "0 8px 34px rgba(0,0,0,0.78)",
      "0 0 0 1px rgba(255,255,255,0.07) inset",
      "0 0 32px rgba(168,85,247,0.44)",
      "0 0 64px rgba(109,40,217,0.2)",
    ].join(", "),
    bestMatchBadge: true,
    lineOpacity: 0.42, lineW: 0.9,
  },
  // 1 — Strong  (w=172, h=76)
  {
    w: 172, h: 76, avatarSz: 28, nameSz: 9, scoreSz: 12, tagSz: 6.5,
    border: "1px solid rgba(139,92,246,0.54)",
    bg:     "linear-gradient(155deg,rgba(76,29,149,0.44) 0%,rgba(12,5,38,0.68) 100%)",
    shadow: [
      "0 6px 26px rgba(0,0,0,0.72)",
      "0 0 0 1px rgba(255,255,255,0.052) inset",
      "0 0 20px rgba(109,40,217,0.3)",
    ].join(", "),
    bestMatchBadge: false,
    lineOpacity: 0.3, lineW: 0.78,
  },
  // 2  (w=154, h=60)
  {
    w: 154, h: 60, avatarSz: 26, nameSz: 8, scoreSz: 10.5, tagSz: 6,
    border: "1px solid rgba(139,92,246,0.4)",
    bg:     "linear-gradient(155deg,rgba(70,25,140,0.36) 0%,rgba(10,4,30,0.64) 100%)",
    shadow: [
      "0 4px 20px rgba(0,0,0,0.66)",
      "0 0 0 1px rgba(255,255,255,0.04) inset",
      "0 0 12px rgba(109,40,217,0.18)",
    ].join(", "),
    bestMatchBadge: false,
    lineOpacity: 0.22, lineW: 0.7,
  },
  // 3  (w=154, h=60)
  {
    w: 154, h: 60, avatarSz: 26, nameSz: 8, scoreSz: 10.5, tagSz: 6,
    border: "1px solid rgba(139,92,246,0.36)",
    bg:     "linear-gradient(155deg,rgba(65,22,130,0.32) 0%,rgba(9,3,28,0.62) 100%)",
    shadow: [
      "0 4px 18px rgba(0,0,0,0.64)",
      "0 0 0 1px rgba(255,255,255,0.035) inset",
      "0 0 10px rgba(109,40,217,0.14)",
    ].join(", "),
    bestMatchBadge: false,
    lineOpacity: 0.18, lineW: 0.65,
  },
  // 4 — most subtle  (w=154, h=60)
  {
    w: 154, h: 60, avatarSz: 24, nameSz: 7.5, scoreSz: 10, tagSz: 5.5,
    border: "1px solid rgba(139,92,246,0.24)",
    bg:     "linear-gradient(155deg,rgba(55,18,108,0.26) 0%,rgba(7,3,22,0.58) 100%)",
    shadow: [
      "0 3px 14px rgba(0,0,0,0.6)",
      "0 0 0 1px rgba(255,255,255,0.025) inset",
    ].join(", "),
    bestMatchBadge: false,
    lineOpacity: 0.12, lineW: 0.6,
  },
] as const;

// Quadratic Bezier from profile bottom → card top-centre
function curvePath(i: number, tx: number, ty: number): string {
  const topY = ty - CARD_CFG[i].h / 2;
  const qx   = CX + (tx - CX) * 0.44;
  const qy   = LINE_SRC_Y + (topY - LINE_SRC_Y) * 0.36;
  return `M ${CX},${LINE_SRC_Y} Q ${qx},${qy} ${tx},${topY}`;
}

// ─── Stars (deterministic) ────────────────────────────────────────────────────

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  cx: ((i * 137.508 + 11) % 100).toFixed(2),
  cy: ((i * 97.391  + 29) % 100).toFixed(2),
  r:  i % 5 === 0 ? 1.1 : i % 5 === 1 ? 0.75 : i % 5 === 2 ? 0.52 : i % 5 === 3 ? 0.36 : 0.22,
  o:  (0.065 + (i % 7) * 0.032).toFixed(3),
}));

// ─── Component ────────────────────────────────────────────────────────────────

interface ShareCardProps {
  username?:        string;
  predictions:      PredictedAccount[] | null;
  searchedProfile?: SearchedProfile | null;
}

export default function ShareCard({
  username,
  predictions,
  searchedProfile,
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [exportError, setExportError] = useState(false);

  async function proxyToDataUrl(src: string): Promise<string> {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  }

  const handleDownload = useCallback(async () => {
    const el = cardRef.current;
    if (!el || isExporting) return;

    setIsExporting(true);
    setExportError(false);

    const imgs     = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
    const origSrcs = imgs.map((img) => img.src);

    try {
      await Promise.allSettled(
        imgs.map(async (img, i) => {
          try {
            const dataUrl = await proxyToDataUrl(origSrcs[i]);
            img.src = dataUrl;
            await new Promise<void>((resolve) => {
              if (img.complete && img.naturalWidth > 0) { resolve(); return; }
              img.onload  = () => resolve();
              img.onerror = () => resolve();
            });
          } catch { /* keep original */ }
        }),
      );

      setIsCapturing(true);
      await new Promise<void>((r) => setTimeout(r, 120));

      const { toPng }  = await import("html-to-image");
      const pixelRatio = Math.max(2, 1200 / el.offsetWidth);

      const dataUrl = await toPng(el, {
        cacheBust:        false,
        pixelRatio,
        imagePlaceholder:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=",
      });

      setIsCapturing(false);

      const link    = document.createElement("a");
      link.download = `followsignal-${username ?? "card"}.png`;
      link.href     = dataUrl;
      link.click();
    } catch {
      setExportError(true);
      setIsCapturing(false);
    } finally {
      imgs.forEach((img, i) => { img.src = origSrcs[i]; });
      setIsExporting(false);
    }
  }, [isExporting, username]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="relative z-30 mt-24 mb-16 flex flex-col items-center px-4">

      {/* Section heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.4 }}
        className="flex flex-col items-center mb-10"
      >
        <span className="text-[10px] tracking-[0.3em] uppercase text-purple-400/60 mb-3">
          Share Your Results
        </span>
        <h2 className="text-2xl font-bold text-white text-center">
          Built to post directly on X
        </h2>
        <p className="text-sm text-white/40 mt-2 text-center max-w-sm">
          Your signal card is ready. One tap to download and share.
        </p>
      </motion.div>

      {/* Card wrapper */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
        style={{ maxWidth: "100%" }}
      >
        {/* Outer ambient halo */}
        <div
          aria-hidden
          style={{
            position:      "absolute",
            inset:         "-48px",
            borderRadius:  "52px",
            background:    "radial-gradient(ellipse at 50% 35%, rgba(139,92,246,0.38) 0%, transparent 65%)",
            filter:        "blur(44px)",
            pointerEvents: "none",
            zIndex:        -1,
          }}
        />

        {/* Glass border frame */}
        <div
          style={{
            padding:      8,
            borderRadius: 20,
            background:   "linear-gradient(135deg,rgba(255,255,255,0.055) 0%,rgba(139,92,246,0.03) 100%)",
            border:       "1px solid rgba(139,92,246,0.22)",
            boxShadow:    "0 22px 72px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.02) inset",
          }}
        >

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* EXPORTABLE CARD  600 × 360                                     */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          <div
            ref={cardRef}
            style={{
              position:     "relative",
              width:         CARD_W,
              height:        CARD_H,
              maxWidth:     "100%",
              borderRadius:  12,
              overflow:     "hidden",
              background:   "linear-gradient(158deg,#050011 0%,#0e0027 60%,#040010 100%)",
              fontFamily:   "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            }}
          >

            {/* ── L0: Nebula glows ───────────────────────────────────────── */}
            <div aria-hidden style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
              {/* Upper-left cloud */}
              <div style={{
                position:"absolute", left:"-10%", top:"-20%",
                width:"55%", height:"70%", borderRadius:"50%",
                background:"radial-gradient(circle,rgba(80,28,160,0.22) 0%,transparent 70%)",
                filter:"blur(36px)",
              }} />
              {/* Centre overhead radial (behind profile) */}
              <div style={{
                position:"absolute", left:"50%", top:"-5%",
                transform:"translateX(-50%)",
                width:"72%", height:"68%", borderRadius:"50%",
                background:"radial-gradient(circle,rgba(120,40,230,0.32) 0%,rgba(80,30,190,0.1) 48%,transparent 72%)",
                filter:"blur(28px)",
              }} />
              {/* Bottom-right cloud */}
              <div style={{
                position:"absolute", right:"-5%", bottom:"-10%",
                width:"38%", height:"48%", borderRadius:"50%",
                background:"radial-gradient(circle,rgba(50,15,105,0.15) 0%,transparent 70%)",
                filter:"blur(28px)",
              }} />
            </div>

            {/* ── L1: Stars ─────────────────────────────────────────────── */}
            <svg
              aria-hidden
              style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}
            >
              {STARS.map((s) => (
                <circle key={s.id} cx={`${s.cx}%`} cy={`${s.cy}%`} r={s.r} fill="white" opacity={s.o} />
              ))}
            </svg>

            {/* ── L2: Connecting curves + node glows  (behind cards) ─────── */}
            <svg
              aria-hidden
              style={{
                position:"absolute", inset:0,
                width:"100%", height:"100%",
                overflow:"visible",
                zIndex:5, pointerEvents:"none",
              }}
            >
              <defs>
                {/* Curve gradients */}
                {(predictions ?? []).map((_, i) => {
                  const pos = CARD_POS[i];
                  if (!pos) return null;
                  return (
                    <linearGradient
                      key={`lg-${i}`}
                      id={`lg-${i}`}
                      x1={CX} y1={LINE_SRC_Y}
                      x2={pos.x} y2={pos.y}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%"   stopColor="rgba(168,85,247,0.9)"  />
                      <stop offset="85%"  stopColor="rgba(99,102,241,0.08)" />
                      <stop offset="100%" stopColor="rgba(99,102,241,0)"    />
                    </linearGradient>
                  );
                })}
                {/* Glow filter for endpoint nodes */}
                <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Orbit rings (decorative — centred on profile) */}
              <circle
                cx={CX} cy={CY_PROFILE} r={54}
                fill="none" stroke="rgba(139,92,246,0.11)" strokeWidth={0.65} strokeDasharray="2 9"
              />
              <ellipse
                cx={CX} cy={CY_PROFILE} rx={92} ry={58}
                fill="none" stroke="rgba(139,92,246,0.07)" strokeWidth={0.55} strokeDasharray="3 13"
              />
              <ellipse
                cx={CX} cy={CY_PROFILE} rx={132} ry={82}
                fill="none" stroke="rgba(109,40,217,0.046)" strokeWidth={0.5} strokeDasharray="2 16"
              />

              {/* Bezier curves */}
              {(predictions ?? []).map((_, i) => {
                const pos = CARD_POS[i];
                if (!pos) return null;
                const cfg = CARD_CFG[i];
                return (
                  <path
                    key={`c-${i}`}
                    d={curvePath(i, pos.x, pos.y)}
                    fill="none"
                    stroke={`url(#lg-${i})`}
                    strokeWidth={cfg.lineW}
                    strokeLinecap="round"
                    opacity={cfg.lineOpacity}
                  />
                );
              })}

              {/* Glowing endpoint nodes (at card top-centre only) */}
              {(predictions ?? []).map((_, i) => {
                const pos = CARD_POS[i];
                if (!pos) return null;
                const topY = pos.y - CARD_CFG[i].h / 2;
                return (
                  <circle
                    key={`n-${i}`}
                    cx={pos.x} cy={topY}
                    r={2.4}
                    fill="rgba(168,85,247,0.65)"
                    filter="url(#node-glow)"
                    opacity={CARD_CFG[i].lineOpacity * 1.6}
                  />
                );
              })}

              {/* Source node at profile bottom */}
              {predictions && predictions.length > 0 && (
                <circle
                  cx={CX} cy={LINE_SRC_Y} r={2.6}
                  fill="rgba(168,85,247,0.7)"
                  filter="url(#node-glow)"
                />
              )}
            </svg>

            {/* ── L3: Centre profile ───────────────────────────────────── */}
            <div
              style={{
                position:  "absolute",
                left:       CX, top: CY_PROFILE,
                transform: "translate(-50%,-50%)",
                zIndex:    20,
              }}
            >
              <motion.div
                animate={isCapturing ? { y: 0 } : { y: [0, -5, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}
              >
                {/* Outer orbit ring + inner avatar ring — nested */}
                <div style={{ position:"relative", width: CENTER_SIZE + 28, height: CENTER_SIZE + 28 }}>

                  {/* Wide soft glow */}
                  <div style={{
                    position:"absolute", inset:-22, borderRadius:"50%",
                    background:"radial-gradient(circle,rgba(139,92,246,0.58) 0%,rgba(80,30,180,0.2) 45%,transparent 70%)",
                    filter:"blur(16px)",
                  }} />

                  {/* Outer slow-spinning partial arc ring */}
                  <motion.div
                    animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                    transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                    style={{
                      position:"absolute", inset:0, borderRadius:"50%",
                      border:"1.5px solid transparent",
                      borderTop: "1.5px solid rgba(192,132,252,0.55)",
                      borderRight:"1px solid rgba(139,92,246,0.18)",
                      borderBottom:"1px solid rgba(79,70,229,0.06)",
                    }}
                  />

                  {/* Counter-rotating faint ring */}
                  <motion.div
                    animate={isCapturing ? { rotate: 0 } : { rotate: -360 }}
                    transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                    style={{
                      position:"absolute", inset:4, borderRadius:"50%",
                      border:"1px solid transparent",
                      borderTop: "1px solid rgba(139,92,246,0.2)",
                      borderLeft:"1px solid rgba(168,85,247,0.08)",
                    }}
                  />

                  {/* Inner avatar container — centred inside outer ring */}
                  <div style={{
                    position:"absolute",
                    top:"50%", left:"50%",
                    transform:"translate(-50%,-50%)",
                    width: CENTER_SIZE, height: CENTER_SIZE,
                  }}>
                    {/* Rotating conic ring */}
                    <motion.div
                      animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                      style={{
                        position:"absolute", inset:-2, borderRadius:"50%",
                        background:"conic-gradient(from 0deg,#a855f7 0%,#6366f1 32%,#1e1b4b 58%,#a855f7 100%)",
                      }}
                    />
                    {/* Dark separator */}
                    <div style={{ position:"absolute", inset:2, borderRadius:"50%", background:"#06000f" }} />
                    {/* Avatar */}
                    <div style={{
                      position:"absolute", inset:5, borderRadius:"50%",
                      overflow:"hidden",
                      background:"linear-gradient(135deg,#3b0764,#1e1b4b)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      {searchedProfile?.avatar ? (
                        <Image
                          src={searchedProfile.avatar}
                          alt={searchedProfile.displayName}
                          width={CENTER_AVATAR}
                          height={CENTER_AVATAR}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      ) : searchedProfile ? (
                        <span style={{ color:"white", fontSize:24, fontWeight:900 }}>
                          {searchedProfile.displayName.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <div style={{ width:"100%", height:"100%", background:"rgba(139,92,246,0.08)" }} />
                      )}
                    </div>
                    {/* Ring glow */}
                    <div style={{
                      position:"absolute", inset:0, borderRadius:"50%",
                      boxShadow:"0 0 22px rgba(168,85,247,0.58), 0 0 44px rgba(109,40,217,0.24)",
                      pointerEvents:"none",
                    }} />
                  </div>
                </div>

                {/* Name + username */}
                <div style={{ textAlign:"center", marginTop:-4 }}>
                  <div style={{
                    color:"rgba(255,255,255,0.95)",
                    fontSize:11.5, fontWeight:700,
                    letterSpacing:"0.028em", lineHeight:1.2,
                    maxWidth:130,
                    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                  }}>
                    {searchedProfile?.displayName ?? "—"}
                  </div>
                  <div style={{
                    color:"rgba(168,85,247,0.52)",
                    fontSize:9.5, marginTop:2, letterSpacing:"0.015em",
                  }}>
                    @{searchedProfile?.username ?? username ?? "—"}
                  </div>
                </div>

                {/* Orbit Score badge */}
                {searchedProfile && (
                  <div style={{
                    display:"flex", alignItems:"center", gap:4,
                    padding:"3px 11px", borderRadius:20,
                    background:"linear-gradient(135deg,rgba(109,40,217,0.48),rgba(79,70,229,0.32))",
                    border:"1px solid rgba(139,92,246,0.58)",
                    boxShadow:"0 0 14px rgba(139,92,246,0.34), 0 1px 0 rgba(255,255,255,0.065) inset",
                  }}>
                    <span style={{
                      fontSize:12, fontWeight:900,
                      background:"linear-gradient(90deg,#c084fc,#818cf8)",
                      WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                    }}>
                      {formatScore(searchedProfile.score)}
                    </span>
                    <span style={{
                      fontSize:7.5, color:"rgba(255,255,255,0.28)",
                      letterSpacing:"0.14em", textTransform:"uppercase",
                    }}>
                      Orbit
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── L4: Row heading ───────────────────────────────────────── */}
            {predictions && predictions.length > 0 && (
              <div
                aria-hidden
                style={{
                  position:   "absolute",
                  top:        163,
                  left:       0, right:0,
                  textAlign:  "center",
                  zIndex:     18,
                  pointerEvents:"none",
                }}
              >
                <span style={{
                  fontSize:      6.5,
                  fontWeight:    600,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color:         "rgba(168,130,255,0.38)",
                }}>
                  Top Follow-Back Opportunities
                </span>
              </div>
            )}

            {/* ── L5: Recommendation cards ──────────────────────────────── */}
            {(predictions ?? []).map((acc, i) => {
              const pos = CARD_POS[i];
              if (!pos) return null;
              const cfg = CARD_CFG[i];
              const tag = tagAccent(acc.category ?? "");

              return (
                <div
                  key={acc.id ?? i}
                  style={{
                    position:  "absolute",
                    left:       pos.x, top: pos.y,
                    transform: "translate(-50%,-50%)",
                    zIndex:    20,
                  }}
                >
                  <motion.div
                    animate={isCapturing ? { y: 0 } : { y: [0, -2, 0] }}
                    transition={{
                      duration: 3.8 + i * 0.55,
                      repeat:   Infinity,
                      ease:     "easeInOut",
                      delay:    i * 0.42,
                    }}
                  >
                    {/* Glass chip */}
                    <div
                      style={{
                        position:             "relative",
                        width:                 cfg.w,
                        height:                cfg.h,
                        padding:              "8px 10px 8px",
                        borderRadius:          10,
                        background:            cfg.bg,
                        border:                cfg.border,
                        boxShadow:             cfg.shadow,
                        backdropFilter:       "blur(24px)",
                        WebkitBackdropFilter: "blur(24px)",
                        display:              "flex",
                        flexDirection:        "column",
                        justifyContent:       "space-between",
                        overflow:             "hidden",
                      }}
                    >
                      {/* Glass shimmer reflection */}
                      <div aria-hidden style={{
                        position:  "absolute",
                        top:0, left:0, right:0,
                        height:   "44%",
                        background:"linear-gradient(180deg,rgba(255,255,255,0.055) 0%,transparent 100%)",
                        borderRadius:"10px 10px 0 0",
                        pointerEvents:"none",
                      }} />

                      {/* "Best Match" corner badge (Card 0 only) */}
                      {cfg.bestMatchBadge && (
                        <div style={{
                          position:   "absolute",
                          top:        6, right:8,
                          padding:    "2px 7px",
                          borderRadius:12,
                          background: "linear-gradient(90deg,rgba(192,132,252,0.28),rgba(245,158,11,0.18))",
                          border:     "1px solid rgba(214,162,255,0.52)",
                          boxShadow:  "0 0 10px rgba(192,132,252,0.3)",
                          zIndex:     2,
                        }}>
                          <span style={{
                            fontSize:      5.8,
                            fontWeight:    700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            background:    "linear-gradient(90deg,#f0abfc,#fbbf24)",
                            WebkitBackgroundClip:"text",
                            WebkitTextFillColor: "transparent",
                          }}>
                            ✦ Best Match
                          </span>
                        </div>
                      )}

                      {/* Row A: avatar + name/username */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, position:"relative", zIndex:1 }}>
                        {/* Avatar */}
                        <div style={{
                          width:        cfg.avatarSz,
                          height:       cfg.avatarSz,
                          borderRadius: "50%",
                          overflow:     "hidden",
                          flexShrink:   0,
                          border:       i === 0
                            ? "1.5px solid rgba(192,132,252,0.68)"
                            : i === 1
                              ? "1px solid rgba(139,92,246,0.5)"
                              : "1px solid rgba(139,92,246,0.38)",
                          background:   "linear-gradient(135deg,#3b0764,#1e1b4b)",
                          boxShadow:    i === 0
                            ? "0 0 12px rgba(192,132,252,0.5)"
                            : i === 1
                              ? "0 0 7px rgba(139,92,246,0.3)"
                              : "none",
                        }}>
                          <Image
                            src={acc.avatar}
                            alt={acc.name}
                            width={cfg.avatarSz}
                            height={cfg.avatarSz}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        </div>

                        {/* Name + @username */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{
                            color:         i < 2 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.86)",
                            fontSize:      cfg.nameSz,
                            fontWeight:    700,
                            lineHeight:    1.25,
                            whiteSpace:    "nowrap",
                            overflow:      "hidden",
                            textOverflow:  "ellipsis",
                            // leave space for "Best Match" badge on card 0
                            paddingRight:  cfg.bestMatchBadge ? 74 : 0,
                          }}>
                            {acc.name}
                          </div>
                          <div style={{
                            color:        i < 2 ? "rgba(168,85,247,0.56)" : "rgba(168,85,247,0.42)",
                            fontSize:     cfg.nameSz - 1.5,
                            lineHeight:   1.25,
                            marginTop:    1,
                            whiteSpace:   "nowrap",
                            overflow:     "hidden",
                            textOverflow: "ellipsis",
                          }}>
                            @{acc.username.replace(/^@/, "")}
                          </div>
                        </div>
                      </div>

                      {/* Row B: score + category tag */}
                      <div style={{
                        display:"flex", alignItems:"center",
                        justifyContent:"space-between", gap:4,
                        position:"relative", zIndex:1,
                      }}>
                        <span style={{
                          fontSize:             cfg.scoreSz,
                          fontWeight:           900,
                          letterSpacing:        "0.01em",
                          background:           i === 0
                            ? "linear-gradient(90deg,#f0abfc,#fbbf24)"
                            : i === 1
                              ? "linear-gradient(90deg,#e879f9,#a78bfa)"
                              : "linear-gradient(90deg,#d946ef,#818cf8)",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor:  "transparent",
                          flexShrink:           0,
                        }}>
                          {acc.score != null ? formatScore(acc.score) : `${acc.matchPercent}%`}
                        </span>
                        <span style={{
                          fontSize:      cfg.tagSz,
                          fontWeight:    600,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          padding:       "1.5px 5px",
                          borderRadius:  20,
                          whiteSpace:    "nowrap",
                          ...tag,
                        }}>
                          {acc.category}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}

            {/* ── L6: Header bar ────────────────────────────────────────── */}
            <div style={{
              position:       "absolute",
              top:0, left:0, right:0,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "11px 16px",
              background:     "linear-gradient(180deg,rgba(5,0,17,0.95) 0%,transparent 100%)",
              zIndex:         30,
              pointerEvents:  "none",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <div style={{
                  width:16, height:16, borderRadius:5,
                  background:  "linear-gradient(135deg,#7c3aed,#4f46e5)",
                  boxShadow:   "0 0 8px rgba(124,58,237,0.65)",
                  display:     "flex", alignItems:"center", justifyContent:"center",
                  flexShrink:  0,
                }}>
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5"   r="1.5" fill="white" />
                    <circle cx="5" cy="1.5" r="0.9" fill="rgba(255,255,255,0.7)" />
                    <circle cx="5" cy="8.5" r="0.9" fill="rgba(255,255,255,0.7)" />
                    <circle cx="1.5" cy="5" r="0.9" fill="rgba(255,255,255,0.7)" />
                    <circle cx="8.5" cy="5" r="0.9" fill="rgba(255,255,255,0.7)" />
                  </svg>
                </div>
                <span style={{
                  fontSize:9.5, fontWeight:800, letterSpacing:"0.15em",
                  textTransform:"uppercase",
                  background:"linear-gradient(90deg,#c084fc,#818cf8)",
                  WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                }}>
                  FollowSignal
                </span>
              </div>
              <span style={{
                fontSize:7, color:"rgba(255,255,255,0.18)",
                letterSpacing:"0.2em", textTransform:"uppercase",
              }}>
                AI Network Scan
              </span>
            </div>

            {/* ── L7: Footer bar ────────────────────────────────────────── */}
            <div style={{
              position:       "absolute",
              bottom:0, left:0, right:0,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              padding:        "8px 16px",
              background:     "linear-gradient(0deg,rgba(5,0,17,0.95) 0%,transparent 100%)",
              zIndex:         30,
              pointerEvents:  "none",
            }}>
              <span style={{
                fontSize:6.5, color:"rgba(255,255,255,0.14)",
                letterSpacing:"0.12em", textTransform:"uppercase",
              }}>
                AI-Discovered Follow-Back Opportunities
              </span>
              <span style={{ fontSize:6.5, color:"rgba(180,150,230,0.24)" }}>
                followsignal.app · @mhknft
              </span>
            </div>

            {/* ── Skeleton overlay ──────────────────────────────────────── */}
            {predictions === null && (
              <div style={{
                position:"absolute", inset:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background:"rgba(5,0,17,0.5)", zIndex:40,
              }}>
                <span style={{
                  fontSize:9, letterSpacing:"0.25em",
                  textTransform:"uppercase", color:"rgba(168,85,247,0.38)",
                }}>
                  Scanning…
                </span>
              </div>
            )}

          </div>
          {/* /exportable card */}
        </div>
      </motion.div>

      {/* ── Download button ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.9 }}
        className="flex flex-col items-center gap-3"
      >
        <motion.button
          onClick={handleDownload}
          disabled={isExporting || predictions === null}
          whileHover={isExporting || predictions === null ? {} : { scale: 1.04 }}
          whileTap={isExporting  || predictions === null ? {} : { scale: 0.97 }}
          className="relative px-10 py-4 rounded-2xl font-bold text-sm tracking-wide text-white overflow-hidden group"
          style={{
            background: isExporting
              ? "linear-gradient(135deg,#4c1d95,#3730a3)"
              : "linear-gradient(135deg,#7c3aed 0%,#6d28d9 50%,#4f46e5 100%)",
            boxShadow:  "0 0 0 1px rgba(168,85,247,0.3), 0 8px 32px rgba(109,40,217,0.4), 0 2px 0 rgba(255,255,255,0.1) inset",
            opacity:    predictions === null ? 0.45 : 1,
            cursor:     isExporting || predictions === null ? "default" : "pointer",
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background:"linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%)" }}
          />
          <span className="relative flex items-center gap-2">
            {isExporting ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  className="inline-block w-4 h-4 rounded-full border-2"
                  style={{ borderColor:"rgba(255,255,255,0.2)", borderTopColor:"rgba(255,255,255,0.9)" }}
                />
                Preparing image…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 1v9m0 0L5 7m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"
                    stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
                Download Share Card
              </>
            )}
          </span>
        </motion.button>

        {exportError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] tracking-wide text-center"
            style={{ color: "rgba(248,113,113,0.8)" }}
          >
            Could not generate image. Please try again.
          </motion.p>
        )}

        <p className="text-[11px] text-white/30 tracking-wide">
          Optimized for X · 1200px wide
        </p>
      </motion.div>

    </section>
  );
}
