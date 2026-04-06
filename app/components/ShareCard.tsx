"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { PredictedAccount, SearchedProfile } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M followers";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K followers";
  return n + " followers";
}

// Tag accent colours — partial-match on category string
function tagAccent(cat: string): { bg: string; border: string; color: string } {
  const c = cat.toLowerCase();
  if (c.includes("best") || c.includes("rare"))
    return { bg: "linear-gradient(90deg,rgba(192,132,252,0.22),rgba(245,158,11,0.14))",
             border: "1px solid rgba(210,155,255,0.58)", color: "rgba(242,174,255,0.97)" };
  if (c.includes("near"))
    return { bg: "rgba(168,85,247,0.22)",  border: "1px solid rgba(168,85,247,0.54)",  color: "rgba(216,180,254,0.96)" };
  if (c.includes("strong"))
    return { bg: "rgba(99,102,241,0.22)",  border: "1px solid rgba(99,102,241,0.52)",  color: "rgba(165,180,252,0.96)" };
  if (c.includes("potential") || c.includes("high"))
    return { bg: "rgba(236,72,153,0.18)",  border: "1px solid rgba(236,72,153,0.48)",  color: "rgba(249,168,212,0.96)" };
  if (c.includes("watch") || c.includes("possible"))
    return { bg: "rgba(100,100,140,0.18)", border: "1px solid rgba(155,148,200,0.34)", color: "rgba(188,184,226,0.78)" };
  return   { bg: "rgba(139,92,246,0.2)",   border: "1px solid rgba(139,92,246,0.46)",  color: "rgba(200,172,255,0.92)" };
}

// ─── Layout constants ──────────────────────────────────────────────────────────
// Card renders at 600 × 360; exported at ×2 → 1 200 × 720 px.
// Mobile view uses CSS scale transform — full 600 px always rendered for export.

const CARD_W = 600;
const CARD_H = 360;

const FRAME_PAD = 9;
const FRAME_W   = CARD_W + FRAME_PAD * 2;  // 618
const FRAME_H   = CARD_H + FRAME_PAD * 2;  // 378

// ── Main profile — left anchor (~31 % from left, slightly above vertical centre)
const PROFILE_CX    = 185;
const PROFILE_CY    = 175;
const CENTER_SIZE   = 80;    // conic ring container
const CENTER_AVATAR = 66;    // inner avatar diameter

// Chain connector source: right edge of profile visual block
const LINE_SRC_X = 248;
const LINE_SRC_Y = 175;

// ── Suggestion cards — all equal size, zig-zag chain on right side
// Width 268 px  (half = 134)  ·  Height 62 px  (half = 31)
// Right col x=460:  L=326  R=594  (6 px margin)
// Left  col x=400:  L=266  R=534
// Vertical gap between consecutive cards: 2 px
// Edge check:
//   Card 0 (460, 64):  T=33  B=95   header ≤30 px → 3 px clear ✓
//   Card 1 (400,128):  T=97  B=159  gap=2 ✓
//   Card 2 (460,192):  T=161 B=223  gap=2 ✓
//   Card 3 (400,256):  T=225 B=287  gap=2 ✓
//   Card 4 (460,320):  T=289 B=351  footer at 352 → 1 px clear ✓
const CHAIN_W = 268;
const CHAIN_H = 62;

const CHAIN_POS = [
  { x: 460, y:  64 },  // 0 — top-right
  { x: 400, y: 128 },  // 1 — left
  { x: 460, y: 192 },  // 2 — right
  { x: 400, y: 256 },  // 3 — left
  { x: 460, y: 320 },  // 4 — bottom-right
] as const;

// Left-centre connection node on each card (where the zig-zag line meets)
const CHAIN_NODES = CHAIN_POS.map((p) => ({ x: p.x - CHAIN_W / 2, y: p.y }));
// → [ (326,64), (266,128), (326,192), (266,256), (326,320) ]

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
  const cardRef    = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [exportError, setExportError] = useState(false);

  // ── Mobile scale: CSS transform scales card down on small screens.
  // The ref element always renders at full 600 px — exports at correct resolution.
  const [cardScale, setCardScale] = useState(1);
  const [mounted,   setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    function update() {
      const available = window.innerWidth - 32;
      setCardScale(available < FRAME_W ? Math.max(0.38, available / FRAME_W) : 1);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scale = mounted ? cardScale : 1;

  // ── Image proxy (CORS bypass for Twitter CDN avatars) ─────────────────────────
  async function proxyToDataUrl(src: string): Promise<string> {
    if (!src || src.startsWith("data:") || src.startsWith("/")) return src;
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`);
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader       = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("reader failed"));
      reader.readAsDataURL(blob);
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────────
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
            await new Promise<void>((res) => {
              if (img.complete && img.naturalWidth > 0) { res(); return; }
              img.onload  = () => res();
              img.onerror = () => res();
            });
          } catch { /* keep original */ }
        }),
      );

      setIsCapturing(true);
      await new Promise<void>((r) => setTimeout(r, 120));

      const { toPng } = await import("html-to-image");
      const pixelRatio = Math.max(2, 1200 / el.offsetWidth);

      const dataUrl = await toPng(el, {
        cacheBust:        false,
        pixelRatio,
        width:            CARD_W,
        height:           CARD_H,
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

  // ── Render ────────────────────────────────────────────────────────────────────
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

      {/* ── Card preview + scaling container ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        {/* Outer ambient halo */}
        <div aria-hidden style={{
          position:      "absolute",
          inset:         -48,
          borderRadius:  52,
          background:    "radial-gradient(ellipse at 30% 50%,rgba(139,92,246,0.38) 0%,transparent 65%)",
          filter:        "blur(44px)",
          pointerEvents: "none",
          zIndex:        -1,
        }} />

        {/* Size-controlled outer wrapper */}
        <div style={{ position: "relative", width: FRAME_W * scale, height: FRAME_H * scale }}>
          {/* Full-size render wrapper — scale transform only, no layout effect */}
          <div style={{
            position:        "absolute",
            top:             0,
            left:            0,
            width:           FRAME_W,
            height:          FRAME_H,
            transform:       scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}>
            {/* Glass border frame */}
            <div style={{
              padding:      FRAME_PAD,
              borderRadius: 20,
              width:        "100%",
              height:       "100%",
              background:   "linear-gradient(135deg,rgba(255,255,255,0.055) 0%,rgba(139,92,246,0.03) 100%)",
              border:       "1px solid rgba(139,92,246,0.22)",
              boxShadow:    "0 22px 72px rgba(0,0,0,0.85),0 0 0 1px rgba(255,255,255,0.02) inset",
              boxSizing:    "border-box",
            }}>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* EXPORTABLE CARD  600 × 360                                     */}
              {/* overflow:hidden clips any sub-pixel bleed during export         */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div
                ref={cardRef}
                style={{
                  position:   "relative",
                  width:       CARD_W,
                  height:      CARD_H,
                  borderRadius: 12,
                  overflow:   "hidden",
                  background: "linear-gradient(158deg,#050011 0%,#0e0027 60%,#040010 100%)",
                  fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                }}
              >

                {/* ── L0: Nebula glows ──────────────────────────────────────── */}
                <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {/* Profile-side glow (left) */}
                  <div style={{
                    position: "absolute", left: "-5%", top: "5%",
                    width: "55%", height: "90%", borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(109,40,217,0.38) 0%,rgba(80,28,160,0.14) 45%,transparent 72%)",
                    filter: "blur(34px)",
                  }} />
                  {/* Cards-side subtle ambient (right) */}
                  <div style={{
                    position: "absolute", right: "-5%", top: "0%",
                    width: "50%", height: "100%", borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(55,18,108,0.2) 0%,transparent 70%)",
                    filter: "blur(28px)",
                  }} />
                  {/* Top-centre soft highlight */}
                  <div style={{
                    position: "absolute", left: "15%", top: "-15%",
                    width: "70%", height: "55%", borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(120,40,230,0.15) 0%,transparent 65%)",
                    filter: "blur(22px)",
                  }} />
                </div>

                {/* ── L1: Stars ─────────────────────────────────────────────── */}
                <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  {STARS.map((s) => (
                    <circle key={s.id} cx={`${s.cx}%`} cy={`${s.cy}%`} r={s.r} fill="white" opacity={s.o} />
                  ))}
                </svg>

                {/* ── L2: Chain SVG — connector lines + nodes (z=5, behind cards) */}
                <svg
                  aria-hidden
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 5, pointerEvents: "none" }}
                >
                  <defs>
                    <filter id="nglow" x="-120%" y="-120%" width="340%" height="340%">
                      <feGaussianBlur stdDeviation="2.8" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    {/* Top-to-bottom gradient for chain line */}
                    <linearGradient id="chainGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
                      <stop offset="0%"   stopColor="rgba(192,132,252,0.85)" />
                      <stop offset="45%"  stopColor="rgba(139,92,246,0.55)" />
                      <stop offset="100%" stopColor="rgba(99,102,241,0.22)" />
                    </linearGradient>
                  </defs>

                  {/* Decorative orbit rings around profile */}
                  <circle cx={PROFILE_CX} cy={PROFILE_CY} r={58}
                    fill="none" stroke="rgba(139,92,246,0.09)" strokeWidth={0.6} strokeDasharray="2 10" />
                  <ellipse cx={PROFILE_CX} cy={PROFILE_CY} rx={94} ry={64}
                    fill="none" stroke="rgba(139,92,246,0.055)" strokeWidth={0.5} strokeDasharray="3 14" />

                  {/* Zig-zag chain polyline: source → card0 → card1 → … → card4 */}
                  {predictions && predictions.length > 0 && (
                    <polyline
                      points={[
                        `${LINE_SRC_X},${LINE_SRC_Y}`,
                        ...CHAIN_NODES.slice(0, predictions.length).map((n) => `${n.x},${n.y}`),
                      ].join(" ")}
                      fill="none"
                      stroke="url(#chainGrad)"
                      strokeWidth="0.95"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.62"
                    />
                  )}

                  {/* Source node (right of profile) */}
                  {predictions && predictions.length > 0 && (
                    <circle cx={LINE_SRC_X} cy={LINE_SRC_Y} r={3}
                      fill="rgba(192,132,252,0.85)" filter="url(#nglow)" />
                  )}

                  {/* Card connection nodes (left-centre of each card) */}
                  {(predictions ?? []).map((_, i) => {
                    const n = CHAIN_NODES[i]; if (!n) return null;
                    return (
                      <circle key={`n${i}`} cx={n.x} cy={n.y} r={2.2}
                        fill="rgba(168,85,247,0.7)"
                        filter="url(#nglow)"
                        opacity={0.72 - i * 0.08} />
                    );
                  })}
                </svg>

                {/* ── L3: Main profile (left anchor) ────────────────────────── */}
                <div style={{
                  position:  "absolute",
                  left:       PROFILE_CX,
                  top:        PROFILE_CY,
                  transform: "translate(-50%,-50%)",
                  zIndex:    20,
                }}>
                  <motion.div
                    animate={isCapturing ? { y: 0 } : { y: [0, -4, 0] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  >
                    {/* Avatar ring system */}
                    <div style={{ position: "relative", width: CENTER_SIZE + 18, height: CENTER_SIZE + 18 }}>

                      {/* Wide ambient glow */}
                      <div style={{
                        position: "absolute", inset: -22, borderRadius: "50%",
                        background: "radial-gradient(circle,rgba(139,92,246,0.6) 0%,rgba(80,30,180,0.2) 45%,transparent 70%)",
                        filter: "blur(16px)",
                      }} />

                      {/* Outer rotating arc */}
                      <motion.div
                        animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                        style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          borderTop:    "1.5px solid rgba(192,132,252,0.58)",
                          borderRight:  "1px solid rgba(139,92,246,0.2)",
                          borderBottom: "1px solid rgba(79,70,229,0.06)",
                          borderLeft:   "1px solid transparent",
                        }}
                      />

                      {/* Counter-rotating faint ring */}
                      <motion.div
                        animate={isCapturing ? { rotate: 0 } : { rotate: -360 }}
                        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                        style={{
                          position: "absolute", inset: 5, borderRadius: "50%",
                          borderTop:    "1px solid rgba(139,92,246,0.22)",
                          borderLeft:   "1px solid rgba(168,85,247,0.1)",
                          borderRight:  "1px solid transparent",
                          borderBottom: "1px solid transparent",
                        }}
                      />

                      {/* Inner avatar container */}
                      <div style={{
                        position: "absolute", top: "50%", left: "50%",
                        transform: "translate(-50%,-50%)",
                        width: CENTER_SIZE, height: CENTER_SIZE,
                      }}>
                        {/* Rotating conic ring */}
                        <motion.div
                          animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                          style={{
                            position: "absolute", inset: -2, borderRadius: "50%",
                            background: "conic-gradient(from 0deg,#a855f7 0%,#6366f1 32%,#1e1b4b 58%,#a855f7 100%)",
                          }}
                        />
                        {/* Dark separator */}
                        <div style={{ position: "absolute", inset: 2, borderRadius: "50%", background: "#06000f" }} />
                        {/* Avatar image */}
                        <div style={{
                          position: "absolute", inset: 4, borderRadius: "50%",
                          overflow: "hidden",
                          background: "linear-gradient(135deg,#3b0764,#1e1b4b)",
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
                          boxShadow: "0 0 22px rgba(168,85,247,0.58),0 0 44px rgba(109,40,217,0.24)",
                          pointerEvents: "none",
                        }} />
                      </div>
                    </div>

                    {/* Display name + handle */}
                    <div style={{ textAlign: "center", marginTop: -2 }}>
                      <div style={{
                        color: "rgba(255,255,255,0.96)", fontSize: 12, fontWeight: 700,
                        letterSpacing: "0.025em", lineHeight: 1.2,
                        maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {searchedProfile?.displayName ?? "—"}
                      </div>
                      <div style={{
                        color: "rgba(168,85,247,0.52)", fontSize: 9.5, marginTop: 2,
                        letterSpacing: "0.015em",
                      }}>
                        @{searchedProfile?.username ?? username ?? "—"}
                      </div>
                    </div>

                    {/* Orbit score badge */}
                    {searchedProfile && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 3,
                        padding: "3px 10px", borderRadius: 20,
                        background: "linear-gradient(135deg,rgba(109,40,217,0.46),rgba(79,70,229,0.3))",
                        border: "1px solid rgba(139,92,246,0.58)",
                        boxShadow: "0 0 14px rgba(139,92,246,0.34),0 1px 0 rgba(255,255,255,0.06) inset",
                      }}>
                        <span style={{
                          fontSize: 12, fontWeight: 900,
                          background: "linear-gradient(90deg,#c084fc,#818cf8)",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
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

                {/* ── L4: Suggestion cards — equal-size zig-zag chain ───────── */}
                {(predictions ?? []).map((acc, i) => {
                  const pos = CHAIN_POS[i]; if (!pos) return null;
                  const tag = tagAccent(acc.category ?? "");

                  return (
                    <div
                      key={acc.id ?? i}
                      style={{
                        position:  "absolute",
                        left:       pos.x,
                        top:        pos.y,
                        transform: "translate(-50%,-50%)",
                        zIndex:    20,
                      }}
                    >
                      <motion.div
                        animate={isCapturing ? { y: 0 } : { y: [0, -2.5, 0] }}
                        transition={{ duration: 4 + i * 0.48, repeat: Infinity, ease: "easeInOut", delay: i * 0.36 }}
                      >
                        {/* Glass chip */}
                        <div style={{
                          position:             "relative",
                          width:                 CHAIN_W,
                          height:                CHAIN_H,
                          padding:              "8px 11px",
                          borderRadius:          10,
                          background:           "linear-gradient(155deg,rgba(76,29,149,0.46) 0%,rgba(12,5,38,0.74) 100%)",
                          border:               "1px solid rgba(139,92,246,0.54)",
                          boxShadow:            "0 6px 28px rgba(0,0,0,0.74),0 0 0 1px rgba(255,255,255,0.052) inset,0 0 20px rgba(109,40,217,0.24)",
                          backdropFilter:       "blur(22px)",
                          WebkitBackdropFilter: "blur(22px)",
                          display:              "flex",
                          flexDirection:        "column",
                          justifyContent:       "space-between",
                          overflow:             "hidden",
                        }}>
                          {/* Glass shimmer */}
                          <div aria-hidden style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: "42%",
                            background: "linear-gradient(180deg,rgba(255,255,255,0.055) 0%,transparent 100%)",
                            borderRadius: "10px 10px 0 0", pointerEvents: "none",
                          }} />

                          {/* Row A: avatar + name block ───────────────────────── */}
                          <div style={{ display: "flex", alignItems: "center", gap: 7, position: "relative", zIndex: 1 }}>
                            {/* Avatar */}
                            <div style={{
                              width:        28,
                              height:       28,
                              borderRadius: "50%",
                              overflow:     "hidden",
                              flexShrink:   0,
                              border:       "1px solid rgba(139,92,246,0.52)",
                              background:   "linear-gradient(135deg,#3b0764,#1e1b4b)",
                              boxShadow:    "0 0 8px rgba(139,92,246,0.3)",
                            }}>
                              <Image
                                src={acc.avatar}
                                alt={acc.name}
                                width={28}
                                height={28}
                                className="object-cover w-full h-full"
                                unoptimized
                              />
                            </div>

                            {/* Name block */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Top row: name + verification badge + follower count */}
                              <div style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between", gap: 4,
                              }}>
                                {/* Name + badge */}
                                <div style={{
                                  display: "flex", alignItems: "center", gap: 3,
                                  minWidth: 0, overflow: "hidden",
                                }}>
                                  <span style={{
                                    color:        "rgba(255,255,255,0.94)",
                                    fontSize:      9,
                                    fontWeight:    700,
                                    whiteSpace:   "nowrap",
                                    overflow:     "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth:      108,
                                  }}>
                                    {acc.name}
                                  </span>
                                  {/* Blue verification checkmark */}
                                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                                    <circle cx="5" cy="5" r="5" fill="#1d9bf0" />
                                    <path d="M2.8 5l1.5 1.6L7.4 3.2"
                                      stroke="white" strokeWidth="1.35"
                                      strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </div>
                                {/* Follower count */}
                                <span style={{
                                  fontSize:   7.5,
                                  color:      "rgba(148,163,184,0.72)",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}>
                                  {formatFollowers(acc.followers)}
                                </span>
                              </div>
                              {/* Handle */}
                              <div style={{
                                fontSize:     7.5,
                                color:        "rgba(168,85,247,0.54)",
                                marginTop:    1.5,
                                whiteSpace:   "nowrap",
                                overflow:     "hidden",
                                textOverflow: "ellipsis",
                              }}>
                                @{acc.username.replace(/^@/, "")}
                              </div>
                            </div>
                          </div>

                          {/* Row B: orbit score + category tag ───────────────── */}
                          <div style={{
                            display:        "flex",
                            alignItems:     "center",
                            justifyContent: "space-between",
                            gap:            4,
                            position:       "relative",
                            zIndex:         1,
                          }}>
                            <span style={{
                              fontSize:             13,
                              fontWeight:           900,
                              letterSpacing:        "0.01em",
                              background:           "linear-gradient(90deg,#d946ef,#818cf8)",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor:  "transparent",
                              flexShrink:           0,
                            }}>
                              {acc.score != null ? formatScore(acc.score) : `${acc.matchPercent}%`}
                            </span>
                            <span style={{
                              fontSize:      6.5,
                              fontWeight:    600,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              padding:       "2px 6px",
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

                {/* ── L5: Header ────────────────────────────────────────────── */}
                <div style={{
                  position:       "absolute",
                  top:            0, left: 0, right: 0,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "11px 16px",
                  background:     "linear-gradient(180deg,rgba(5,0,17,0.95) 0%,transparent 100%)",
                  zIndex:         30,
                  pointerEvents:  "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 5,
                      background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                      boxShadow: "0 0 8px rgba(124,58,237,0.65)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
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
                      fontSize: 9.5, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase",
                      background: "linear-gradient(90deg,#c084fc,#818cf8)",
                      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    }}>
                      FollowSignal
                    </span>
                  </div>
                  <span style={{
                    fontSize: 7, color: "rgba(255,255,255,0.18)",
                    letterSpacing: "0.2em", textTransform: "uppercase",
                  }}>
                    AI Network Scan
                  </span>
                </div>

                {/* ── L6: Footer ────────────────────────────────────────────── */}
                <div style={{
                  position:       "absolute",
                  bottom:         0, left: 0, right: 0,
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "8px 16px",
                  background:     "linear-gradient(0deg,rgba(5,0,17,0.95) 0%,transparent 100%)",
                  zIndex:         30,
                  pointerEvents:  "none",
                }}>
                  <span style={{
                    fontSize: 6.5, color: "rgba(255,255,255,0.14)",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                  }}>
                    AI-Discovered Follow-Back Opportunities
                  </span>
                  <span style={{ fontSize: 6.5, color: "rgba(180,150,230,0.24)" }}>
                    followsignal.app · @mhknft
                  </span>
                </div>

                {/* ── Skeleton (predictions still loading) ──────────────────── */}
                {predictions === null && (
                  <div style={{
                    position:   "absolute", inset: 0,
                    display:    "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(5,0,17,0.5)", zIndex: 40,
                  }}>
                    <span style={{
                      fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase",
                      color: "rgba(168,85,247,0.38)",
                    }}>
                      Scanning…
                    </span>
                  </div>
                )}

              </div>
              {/* /exportable card */}
            </div>
            {/* /glass frame */}
          </div>
          {/* /full-size render wrapper */}
        </div>
        {/* /size-controlled outer wrapper */}
      </motion.div>

      {/* ── Download button ────────────────────────────────────────────────────── */}
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
            boxShadow:  "0 0 0 1px rgba(168,85,247,0.3),0 8px 32px rgba(109,40,217,0.4),0 2px 0 rgba(255,255,255,0.1) inset",
            opacity:    predictions === null ? 0.45 : 1,
            cursor:     isExporting || predictions === null ? "default" : "pointer",
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 60%)" }}
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
                  <path d="M8 1v9m0 0L5 7m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1"
                    stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
