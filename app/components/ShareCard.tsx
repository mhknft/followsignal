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

// ─── Card dimensions ──────────────────────────────────────────────────────────
// Rendered at 600 × 320 px; html-to-image exports at ×2 → 1 200 × 640.

const CARD_W = 600;
const CARD_H = 320;
const CX     = 300;  // horizontal centre

// ─── Centre profile ───────────────────────────────────────────────────────────

const CY_PROFILE    = 76;  // y of avatar centre
const CENTER_SIZE   = 80;  // rotating ring container (px)
const CENTER_AVATAR = 66;  // inner avatar diameter (px)

// Where the connecting lines originate — just below score badge
const LINE_SRC_Y = 156;

// ─── Row 1 — 2 strongest cards ───────────────────────────────────────────────

const ROW1_W = 170;
const ROW1_H = 70;
const ROW1   = [
  { x: 204, y: 198 },   // index 0 — brightest/largest
  { x: 396, y: 198 },   // index 1
];

// ─── Row 2 — 3 remaining cards ────────────────────────────────────────────────

const ROW2_W = 148;
const ROW2_H = 58;
const ROW2   = [
  { x: 132, y: 263 },   // index 2
  { x: 300, y: 263 },   // index 3
  { x: 468, y: 263 },   // index 4 — most subtle
];

// All 5 card centres in order (index → position)
const CARD_POS = [...ROW1, ...ROW2];

// ─── Per-card style config (index 0 = strongest → index 4 = subtlest) ────────

const CARD_STYLE = [
  // index 0: hero card — brightest glow, larger avatar
  {
    w: ROW1_W, h: ROW1_H, avatarSz: 30, nameSz: 9, scoreSz: 12, tagSz: 6.5,
    border: "1px solid rgba(168,85,247,0.72)",
    bg:     "linear-gradient(150deg, rgba(90,30,170,0.42) 0%, rgba(16,6,42,0.66) 100%)",
    shadow: [
      "0 6px 28px rgba(0,0,0,0.7)",
      "0 0 0 1px rgba(255,255,255,0.05) inset",
      "0 0 26px rgba(168,85,247,0.38)",
      "0 0 54px rgba(109,40,217,0.18)",
    ].join(", "),
    lineOpacity: 0.5, lineWidth: 1.0,
  },
  // index 1
  {
    w: ROW1_W, h: ROW1_H, avatarSz: 28, nameSz: 8.5, scoreSz: 11, tagSz: 6.5,
    border: "1px solid rgba(139,92,246,0.48)",
    bg:     "linear-gradient(150deg, rgba(76,29,149,0.38) 0%, rgba(12,5,35,0.62) 100%)",
    shadow: [
      "0 5px 24px rgba(0,0,0,0.65)",
      "0 0 0 1px rgba(255,255,255,0.04) inset",
      "0 0 16px rgba(109,40,217,0.24)",
    ].join(", "),
    lineOpacity: 0.38, lineWidth: 0.85,
  },
  // index 2
  {
    w: ROW2_W, h: ROW2_H, avatarSz: 26, nameSz: 8, scoreSz: 10, tagSz: 6,
    border: "1px solid rgba(139,92,246,0.4)",
    bg:     "linear-gradient(150deg, rgba(76,29,149,0.34) 0%, rgba(12,5,35,0.6) 100%)",
    shadow: [
      "0 4px 20px rgba(0,0,0,0.62)",
      "0 0 0 1px rgba(255,255,255,0.034) inset",
      "0 0 12px rgba(109,40,217,0.18)",
    ].join(", "),
    lineOpacity: 0.26, lineWidth: 0.75,
  },
  // index 3
  {
    w: ROW2_W, h: ROW2_H, avatarSz: 26, nameSz: 8, scoreSz: 10, tagSz: 6,
    border: "1px solid rgba(139,92,246,0.38)",
    bg:     "linear-gradient(150deg, rgba(70,25,140,0.3) 0%, rgba(10,4,30,0.58) 100%)",
    shadow: [
      "0 4px 18px rgba(0,0,0,0.6)",
      "0 0 0 1px rgba(255,255,255,0.03) inset",
      "0 0 10px rgba(109,40,217,0.15)",
    ].join(", "),
    lineOpacity: 0.22, lineWidth: 0.7,
  },
  // index 4: most subtle
  {
    w: ROW2_W, h: ROW2_H, avatarSz: 24, nameSz: 7.5, scoreSz: 9.5, tagSz: 5.5,
    border: "1px solid rgba(139,92,246,0.26)",
    bg:     "linear-gradient(150deg, rgba(60,20,120,0.26) 0%, rgba(8,3,24,0.56) 100%)",
    shadow: [
      "0 3px 14px rgba(0,0,0,0.56)",
      "0 0 0 1px rgba(255,255,255,0.022) inset",
    ].join(", "),
    lineOpacity: 0.16, lineWidth: 0.65,
  },
] as const;

// ─── Stars (deterministic) ────────────────────────────────────────────────────

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  cx: ((i * 137.508 + 11) % 100).toFixed(2),
  cy: ((i * 97.391  + 29) % 100).toFixed(2),
  r:  i % 5 === 0 ? 1.15 : i % 5 === 1 ? 0.8 : i % 5 === 2 ? 0.55 : i % 5 === 3 ? 0.38 : 0.25,
  o:  (0.07 + (i % 7) * 0.035).toFixed(3),
}));

// ─── Quadratic bezier path: centre → card top-centre ─────────────────────────

function curvePath(tx: number, ty: number): string {
  const sx  = CX;
  const sy  = LINE_SRC_Y;
  const tcy = ty - (CARD_POS.indexOf(CARD_POS.find((p) => p.y === ty)!) < 2 ? ROW1_H / 2 : ROW2_H / 2);
  // control point: 45 % of horizontal distance, 40 % of vertical distance from source
  const qx = sx + (tx - sx) * 0.45;
  const qy = sy + (tcy - sy) * 0.40;
  return `M ${sx},${sy} Q ${qx},${qy} ${tx},${tcy}`;
}

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

  // ── Avatar proxy (avoids CORS during html-to-image capture) ────────────────
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

  // ── Export to PNG ───────────────────────────────────────────────────────────
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

      const { toPng }   = await import("html-to-image");
      const pixelRatio  = Math.max(2, 1200 / el.offsetWidth);

      const dataUrl = await toPng(el, {
        cacheBust:        false,
        pixelRatio,
        imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=",
      });

      setIsCapturing(false);

      const link     = document.createElement("a");
      link.download  = `followsignal-${username ?? "card"}.png`;
      link.href      = dataUrl;
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

      {/* Section label */}
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
        {/* Ambient outer halo */}
        <div
          aria-hidden
          style={{
            position:      "absolute",
            inset:         "-44px",
            borderRadius:  "50px",
            background:    "radial-gradient(ellipse at 50% 40%, rgba(139,92,246,0.4) 0%, transparent 66%)",
            filter:        "blur(42px)",
            pointerEvents: "none",
            zIndex:        -1,
          }}
        />

        {/* Glass border */}
        <div
          style={{
            padding:      8,
            borderRadius: 20,
            background:   "linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(139,92,246,0.03) 100%)",
            border:       "1px solid rgba(139,92,246,0.24)",
            boxShadow:    "0 20px 70px rgba(0,0,0,0.82), 0 0 0 1px rgba(255,255,255,0.022) inset",
          }}
        >

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* EXPORTABLE CARD — 600 × 320                                     */}
          {/* ════════════════════════════════════════════════════════════════ */}
          <div
            ref={cardRef}
            style={{
              position:     "relative",
              width:         CARD_W,
              height:        CARD_H,
              maxWidth:     "100%",
              borderRadius:  12,
              overflow:     "hidden",
              background:   "linear-gradient(155deg, #050011 0%, #0e0026 58%, #040010 100%)",
              fontFamily:   "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}
          >

            {/* ── L0: Nebula background glows ────────────────────────────── */}
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <div style={{
                position: "absolute", left: "-10%", top: "-20%",
                width: "55%", height: "75%", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(76,29,149,0.22) 0%, transparent 70%)",
                filter: "blur(38px)",
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "0%",
                transform: "translateX(-50%)",
                width: "70%", height: "65%", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(109,40,217,0.3) 0%, rgba(79,70,229,0.08) 50%, transparent 72%)",
                filter: "blur(26px)",
              }} />
              <div style={{
                position: "absolute", right: "-5%", bottom: "-10%",
                width: "38%", height: "50%", borderRadius: "50%",
                background: "radial-gradient(circle, rgba(49,16,101,0.16) 0%, transparent 70%)",
                filter: "blur(30px)",
              }} />
            </div>

            {/* ── L1: Stars ──────────────────────────────────────────────── */}
            <svg
              aria-hidden
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            >
              {STARS.map((s) => (
                <circle key={s.id} cx={`${s.cx}%`} cy={`${s.cy}%`} r={s.r} fill="white" opacity={s.o} />
              ))}
            </svg>

            {/* ── L2: Decorative orbit rings + connecting curves ──────────── */}
            {/* z-index 5 → renders BEHIND cards so Row-2 lines disappear     */}
            {/* behind Row-1 cards rather than crossing over them.             */}
            <svg
              aria-hidden
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                zIndex: 5, pointerEvents: "none",
              }}
            >
              <defs>
                {/* Gradient for each connecting curve */}
                {(predictions ?? []).map((_, i) => {
                  const pos = CARD_POS[i];
                  if (!pos) return null;
                  return (
                    <linearGradient
                      key={`cg-${i}`}
                      id={`curve-grad-${i}`}
                      x1={CX}       y1={LINE_SRC_Y}
                      x2={pos.x}    y2={pos.y}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%"   stopColor="rgba(168,85,247,1)"   />
                      <stop offset="100%" stopColor="rgba(99,102,241,0.0)" />
                    </linearGradient>
                  );
                })}
              </defs>

              {/* Orbit rings behind the centre profile */}
              <circle
                cx={CX} cy={CY_PROFILE} r={52}
                fill="none"
                stroke="rgba(139,92,246,0.12)"
                strokeWidth={0.7}
                strokeDasharray="2 8"
              />
              <ellipse
                cx={CX} cy={CY_PROFILE} rx={90} ry={58}
                fill="none"
                stroke="rgba(139,92,246,0.08)"
                strokeWidth={0.6}
                strokeDasharray="3 12"
              />
              <ellipse
                cx={CX} cy={CY_PROFILE} rx={130} ry={80}
                fill="none"
                stroke="rgba(109,40,217,0.055)"
                strokeWidth={0.5}
                strokeDasharray="2 14"
              />

              {/* Curved connecting lines: centre → each card */}
              {(predictions ?? []).map((_, i) => {
                const pos = CARD_POS[i];
                if (!pos) return null;
                const st = CARD_STYLE[i];
                const d  = curvePath(pos.x, pos.y);
                return (
                  <path
                    key={`curve-${i}`}
                    d={d}
                    fill="none"
                    stroke={`url(#curve-grad-${i})`}
                    strokeWidth={st.lineWidth}
                    strokeLinecap="round"
                    opacity={st.lineOpacity}
                  />
                );
              })}

              {/* Small node dots at card connection points */}
              {(predictions ?? []).map((_, i) => {
                const pos = CARD_POS[i];
                if (!pos) return null;
                const halfH = i < 2 ? ROW1_H / 2 : ROW2_H / 2;
                return (
                  <circle
                    key={`node-${i}`}
                    cx={pos.x}
                    cy={pos.y - halfH}
                    r={1.8}
                    fill="rgba(168,85,247,0.5)"
                    opacity={CARD_STYLE[i].lineOpacity * 1.4}
                  />
                );
              })}

              {/* Source node at bottom of profile block */}
              {predictions && predictions.length > 0 && (
                <circle cx={CX} cy={LINE_SRC_Y} r={2.2} fill="rgba(168,85,247,0.55)" />
              )}
            </svg>

            {/* ── L3: Centre profile ─────────────────────────────────────── */}
            <div
              style={{
                position:  "absolute",
                left:       CX,
                top:        CY_PROFILE,
                transform: "translate(-50%, -50%)",
                zIndex:     20,
              }}
            >
              <motion.div
                animate={isCapturing ? { y: 0 } : { y: [0, -5, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
              >
                {/* Ring + avatar */}
                <div style={{ position: "relative", width: CENTER_SIZE, height: CENTER_SIZE }}>

                  {/* Wide ambient glow behind the ring */}
                  <div style={{
                    position: "absolute", inset: -16, borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 66%)",
                    filter: "blur(12px)",
                  }} />

                  {/* Rotating conic ring */}
                  <motion.div
                    animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                    transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                    style={{
                      position: "absolute", inset: -2, borderRadius: "50%",
                      background: "conic-gradient(from 0deg, #a855f7 0%, #6366f1 30%, #1e1b4b 58%, #a855f7 100%)",
                    }}
                  />

                  {/* Dark separator */}
                  <div style={{
                    position: "absolute", inset: 2, borderRadius: "50%",
                    background: "#06000f",
                  }} />

                  {/* Avatar */}
                  <div style={{
                    position: "absolute", inset: 5, borderRadius: "50%",
                    overflow: "hidden",
                    background: "linear-gradient(135deg, #3b0764, #1e1b4b)",
                    display: "flex", alignItems: "center", justifyContent: "center",
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
                      <span style={{ color: "white", fontSize: 24, fontWeight: 900 }}>
                        {searchedProfile.displayName.charAt(0).toUpperCase()}
                      </span>
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "rgba(139,92,246,0.08)" }} />
                    )}
                  </div>

                  {/* Ring glow */}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    boxShadow: "0 0 22px rgba(168,85,247,0.55), 0 0 44px rgba(109,40,217,0.22)",
                    pointerEvents: "none",
                  }} />
                </div>

                {/* Name + username */}
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    color: "rgba(255,255,255,0.94)", fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.025em", lineHeight: 1.2,
                    maxWidth: 120,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {searchedProfile?.displayName ?? "—"}
                  </div>
                  <div style={{
                    color: "rgba(168,85,247,0.5)", fontSize: 9, marginTop: 2,
                    letterSpacing: "0.01em",
                  }}>
                    @{searchedProfile?.username ?? username ?? "—"}
                  </div>
                </div>

                {/* Orbit Score badge */}
                {searchedProfile && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 10px", borderRadius: 20,
                    background: "linear-gradient(135deg, rgba(109,40,217,0.45), rgba(79,70,229,0.3))",
                    border: "1px solid rgba(139,92,246,0.55)",
                    boxShadow: "0 0 12px rgba(139,92,246,0.32), 0 1px 0 rgba(255,255,255,0.06) inset",
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 900,
                      background: "linear-gradient(90deg, #c084fc, #818cf8)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}>
                      {formatScore(searchedProfile.score)}
                    </span>
                    <span style={{
                      fontSize: 7.5, color: "rgba(255,255,255,0.28)",
                      letterSpacing: "0.14em", textTransform: "uppercase",
                    }}>
                      Orbit
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── L4: Recommendation cards (Row 1 + Row 2) ───────────────── */}
            {(predictions ?? []).map((acc, i) => {
              const pos = CARD_POS[i];
              if (!pos) return null;
              const st = CARD_STYLE[i];

              return (
                /* Position wrapper */
                <div
                  key={acc.id ?? i}
                  style={{
                    position:  "absolute",
                    left:       pos.x,
                    top:        pos.y,
                    transform: "translate(-50%, -50%)",
                    zIndex:    20,
                  }}
                >
                  {/* Float animation wrapper */}
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
                        width:            st.w,
                        height:           st.h,
                        padding:          "8px 10px 8px",
                        borderRadius:     10,
                        background:       st.bg,
                        border:           st.border,
                        boxShadow:        st.shadow,
                        backdropFilter:   "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        display:          "flex",
                        flexDirection:    "column",
                        justifyContent:   "space-between",
                      }}
                    >
                      {/* Row A: avatar + name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {/* Avatar */}
                        <div style={{
                          width:        st.avatarSz,
                          height:       st.avatarSz,
                          borderRadius: "50%",
                          overflow:     "hidden",
                          flexShrink:   0,
                          border:       i === 0
                            ? "1.5px solid rgba(168,85,247,0.65)"
                            : "1px solid rgba(139,92,246,0.42)",
                          background:   "linear-gradient(135deg, #3b0764, #1e1b4b)",
                          boxShadow:    i === 0
                            ? "0 0 10px rgba(168,85,247,0.45)"
                            : "none",
                        }}>
                          <Image
                            src={acc.avatar}
                            alt={acc.name}
                            width={st.avatarSz}
                            height={st.avatarSz}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        </div>

                        {/* Name + @username */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color:         i < 2 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.88)",
                            fontSize:      st.nameSz,
                            fontWeight:    700,
                            lineHeight:    1.25,
                            whiteSpace:    "nowrap",
                            overflow:      "hidden",
                            textOverflow:  "ellipsis",
                          }}>
                            {acc.name}
                          </div>
                          <div style={{
                            color:         i < 2 ? "rgba(168,85,247,0.55)" : "rgba(168,85,247,0.44)",
                            fontSize:      st.nameSz - 1.5,
                            lineHeight:    1.25,
                            marginTop:     1,
                            whiteSpace:    "nowrap",
                            overflow:      "hidden",
                            textOverflow:  "ellipsis",
                          }}>
                            @{acc.username.replace(/^@/, "")}
                          </div>
                        </div>
                      </div>

                      {/* Row B: score + category tag */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                        <span style={{
                          fontSize:              st.scoreSz,
                          fontWeight:            900,
                          letterSpacing:         "0.01em",
                          background:            i === 0
                            ? "linear-gradient(90deg, #f0abfc, #a78bfa)"
                            : "linear-gradient(90deg, #d946ef, #818cf8)",
                          WebkitBackgroundClip:  "text",
                          WebkitTextFillColor:   "transparent",
                          flexShrink:            0,
                        }}>
                          {acc.score != null ? formatScore(acc.score) : `${acc.matchPercent}%`}
                        </span>
                        <span style={{
                          fontSize:       st.tagSz,
                          fontWeight:     600,
                          letterSpacing:  "0.04em",
                          textTransform:  "uppercase",
                          padding:        "1.5px 5px",
                          borderRadius:   20,
                          whiteSpace:     "nowrap",
                          background:     acc.isWildcard
                            ? "rgba(168,85,247,0.24)"
                            : "rgba(79,70,229,0.2)",
                          border:         acc.isWildcard
                            ? "1px solid rgba(168,85,247,0.52)"
                            : "1px solid rgba(99,102,241,0.36)",
                          color:          acc.isWildcard
                            ? "rgba(220,180,255,0.9)"
                            : "rgba(165,140,250,0.84)",
                        }}>
                          {acc.category}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}

            {/* ── L5: Header bar ──────────────────────────────────────────── */}
            <div style={{
              position:   "absolute",
              top: 0, left: 0, right: 0,
              display:    "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding:    "11px 16px",
              background: "linear-gradient(180deg, rgba(5,0,17,0.94) 0%, transparent 100%)",
              zIndex:      30,
              pointerEvents: "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 5,
                  background:  "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow:   "0 0 8px rgba(124,58,237,0.65)",
                  display:     "flex", alignItems: "center", justifyContent: "center",
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
                  fontSize:      9.5,
                  fontWeight:    800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  background:    "linear-gradient(90deg, #c084fc, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor:  "transparent",
                }}>
                  FollowSignal
                </span>
              </div>
              <span style={{
                fontSize:      7,
                color:         "rgba(255,255,255,0.18)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}>
                AI Network Scan
              </span>
            </div>

            {/* ── L6: Footer bar ──────────────────────────────────────────── */}
            <div style={{
              position:   "absolute",
              bottom: 0, left: 0, right: 0,
              display:    "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding:    "8px 16px",
              background: "linear-gradient(0deg, rgba(5,0,17,0.94) 0%, transparent 100%)",
              zIndex:      30,
              pointerEvents: "none",
            }}>
              <span style={{
                fontSize:      6.5,
                color:         "rgba(255,255,255,0.15)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>
                AI-Discovered Follow-Back Opportunities
              </span>
              <span style={{ fontSize: 6.5, color: "rgba(180,150,230,0.25)" }}>
                followsignal.app · @mhknft
              </span>
            </div>

            {/* ── Skeleton overlay ────────────────────────────────────────── */}
            {predictions === null && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(5,0,17,0.5)", zIndex: 40,
              }}>
                <span style={{
                  fontSize:      9,
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  color:         "rgba(168,85,247,0.38)",
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
              ? "linear-gradient(135deg, #4c1d95, #3730a3)"
              : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4f46e5 100%)",
            boxShadow:  "0 0 0 1px rgba(168,85,247,0.3), 0 8px 32px rgba(109,40,217,0.4), 0 2px 0 rgba(255,255,255,0.1) inset",
            opacity:    predictions === null ? 0.45 : 1,
            cursor:     isExporting || predictions === null ? "default" : "pointer",
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%)" }}
          />
          <span className="relative flex items-center gap-2">
            {isExporting ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  className="inline-block w-4 h-4 rounded-full border-2"
                  style={{ borderColor: "rgba(255,255,255,0.2)", borderTopColor: "rgba(255,255,255,0.9)" }}
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
