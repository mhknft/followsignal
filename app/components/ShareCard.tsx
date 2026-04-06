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

// Tag accent colours
function tagAccent(cat: string): { bg: string; border: string; color: string } {
  const c = cat.toLowerCase();
  if (c.includes("best") || c.includes("rare"))
    return { bg: "linear-gradient(90deg,rgba(192,132,252,0.22),rgba(245,158,11,0.14))",
             border: "1px solid rgba(210,155,255,0.58)", color: "rgba(242,174,255,0.97)" };
  if (c.includes("near"))
    return { bg: "rgba(99,102,241,0.2)",   border: "1px solid rgba(120,130,255,0.52)", color: "rgba(180,185,255,0.96)" };
  if (c.includes("strong"))
    return { bg: "rgba(168,85,247,0.2)",   border: "1px solid rgba(192,100,255,0.52)", color: "rgba(216,160,255,0.96)" };
  if (c.includes("potential") || c.includes("high"))
    return { bg: "rgba(236,72,153,0.18)",  border: "1px solid rgba(236,72,153,0.48)",  color: "rgba(249,168,212,0.96)" };
  if (c.includes("watch"))
    return { bg: "rgba(100,130,160,0.18)", border: "1px solid rgba(148,163,200,0.38)", color: "rgba(200,215,240,0.82)" };
  if (c.includes("possible"))
    return { bg: "rgba(109,40,217,0.2)",   border: "1px solid rgba(130,60,230,0.48)",  color: "rgba(185,155,255,0.92)" };
  if (c.includes("weak") || c.includes("confidence"))
    return { bg: "rgba(70,70,110,0.18)",   border: "1px solid rgba(120,100,180,0.32)", color: "rgba(165,150,210,0.76)" };
  return   { bg: "rgba(139,92,246,0.18)",  border: "1px solid rgba(160,100,255,0.44)", color: "rgba(200,165,255,0.9)" };
}

// Per-category avatar glow colors for suggestion cards
function categoryGlow(cat: string): { ring: string; halo: string; node: string } {
  const c = cat.toLowerCase();
  if (c.includes("strong") || c.includes("rare"))
    return { ring: "rgba(210,80,255,0.72)", halo: "rgba(180,60,240,0.28)", node: "rgba(220,100,255,0.9)" };
  if (c.includes("near"))
    return { ring: "rgba(100,120,255,0.7)", halo: "rgba(80,100,240,0.24)", node: "rgba(130,150,255,0.9)" };
  if (c.includes("potential") || c.includes("high"))
    return { ring: "rgba(236,72,180,0.68)", halo: "rgba(210,50,150,0.24)", node: "rgba(245,100,200,0.9)" };
  if (c.includes("watch"))
    return { ring: "rgba(148,163,210,0.55)", halo: "rgba(120,140,190,0.2)", node: "rgba(180,195,235,0.82)" };
  if (c.includes("possible"))
    return { ring: "rgba(109,60,230,0.65)", halo: "rgba(90,40,200,0.22)", node: "rgba(140,80,255,0.85)" };
  return   { ring: "rgba(110,80,200,0.5)",  halo: "rgba(90,60,180,0.18)", node: "rgba(140,110,230,0.78)" };
}

// ─── Layout constants ──────────────────────────────────────────────────────────
// Card renders at 600 x 360 px; exported at x2 = 1200 x 720 px.
// Mobile view uses CSS scale transform only - ref element always 600 px wide.

const CARD_W = 600;
const CARD_H = 360;

const FRAME_PAD = 9;
const FRAME_W   = CARD_W + FRAME_PAD * 2;  // 618
const FRAME_H   = CARD_H + FRAME_PAD * 2;  // 378

// Main profile: left anchor at 31% from left, slightly above centre
const PROFILE_CX    = 185;
const PROFILE_CY    = 175;
const CENTER_SIZE   = 80;
const CENTER_AVATAR = 66;

// Chain connector source: right edge of profile visual
const LINE_SRC_X = 248;
const LINE_SRC_Y = 175;

// All suggestion cards: equal size, zig-zag chain on right side
// CHAIN_W=268 (half=134) x CHAIN_H=62 (half=31)
// Edge check:
//   Card 0 (460, 64):  L=326 R=594  T=33  B=95   OK
//   Card 1 (400,128):  L=266 R=534  T=97  B=159  OK
//   Card 2 (460,192):  L=326 R=594  T=161 B=223  OK
//   Card 3 (400,256):  L=266 R=534  T=225 B=287  OK
//   Card 4 (460,320):  L=326 R=594  T=289 B=351  OK (footer at 352)
const CHAIN_W = 268;
const CHAIN_H = 62;

const CHAIN_POS = [
  { x: 460, y:  64 },
  { x: 400, y: 128 },
  { x: 460, y: 192 },
  { x: 400, y: 256 },
  { x: 460, y: 320 },
] as const;

// Left-centre connector node for each card
const CHAIN_NODES = CHAIN_POS.map((p) => ({ x: p.x - CHAIN_W / 2, y: p.y }));

// Deterministic star field
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

  // Mobile scale: CSS transform scales card down on small screens.
  // ref element always renders at full 600 px for correct export resolution.
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

  // Image proxy: converts remote avatar URL to base64 data URL.
  // Works on mobile Safari by routing through our server-side CORS proxy.
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

  // Export: pre-convert all avatars to base64, freeze animations, generate PNG.
  // Works on mobile Safari: we swap srcset="" and src=dataUrl before calling toPng.
  const handleDownload = useCallback(async () => {
    const el = cardRef.current;
    if (!el || isExporting) return;

    setIsExporting(true);
    setExportError(false);

    const imgs     = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
    const origSrcs = imgs.map((img) => img.src);
    const origSets = imgs.map((img) => img.srcset);

    try {
      // Step 1: Convert every image src to base64 data URL via proxy.
      // Clearing srcset prevents the browser from overriding our swapped src.
      await Promise.allSettled(
        imgs.map(async (img, i) => {
          try {
            const dataUrl = await proxyToDataUrl(origSrcs[i]);
            img.srcset = "";          // disable responsive srcset
            img.src    = dataUrl;
            await new Promise<void>((res) => {
              if (img.complete && img.naturalWidth > 0) { res(); return; }
              img.onload  = () => res();
              img.onerror = () => res();
              setTimeout(res, 3000);  // bail-out after 3 s
            });
          } catch {
            // keep original — placeholder image will render instead
          }
        }),
      );

      // Step 2: Freeze Framer Motion animations at neutral position.
      setIsCapturing(true);

      // Step 3: Wait two animation frames so React/Framer commit their frozen state.
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise<void>((r) => setTimeout(r, 160));

      const { toPng } = await import("html-to-image");

      // Always export at full card resolution - offsetWidth is unaffected by
      // the CSS scale transform applied to parent wrappers on mobile.
      const pixelRatio = Math.max(2, 1200 / el.offsetWidth);

      const dataUrl = await toPng(el, {
        cacheBust:  false,
        pixelRatio,
        width:      CARD_W,
        height:     CARD_H,
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
      // Restore original srcs and srcsets
      imgs.forEach((img, i) => {
        img.src    = origSrcs[i];
        img.srcset = origSets[i];
      });
      setIsExporting(false);
    }
  }, [isExporting, username]);

  const canDownload = predictions !== null && !isExporting;

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

      {/* Card preview + scaling container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        {/* Ambient halo behind card */}
        <div aria-hidden style={{
          position:      "absolute",
          inset:         -52,
          borderRadius:  52,
          background:    "radial-gradient(ellipse at 30% 50%,rgba(139,92,246,0.42) 0%,transparent 65%)",
          filter:        "blur(48px)",
          pointerEvents: "none",
          zIndex:        -1,
        }} />

        {/* Clickable wrapper - same visual area as the scaled card */}
        <motion.div
          onClick={canDownload ? handleDownload : undefined}
          whileHover={canDownload ? { scale: 1.013 } : {}}
          whileTap={canDownload ? { scale: 0.988 } : {}}
          style={{
            position: "relative",
            width:    FRAME_W * scale,
            height:   FRAME_H * scale,
            cursor:   canDownload ? "pointer" : "default",
            borderRadius: 20,
          }}
        >
          {/* Hover glow ring - appears on hover via CSS */}
          {canDownload && (
            <div
              aria-hidden
              className="card-hover-glow"
              style={{
                position: "absolute",
                inset: -2,
                borderRadius: 22,
                border: "1px solid rgba(183,132,255,0)",
                boxShadow: "0 0 0 0 rgba(139,92,246,0)",
                pointerEvents: "none",
                zIndex: 100,
                transition: "box-shadow 0.3s ease, border-color 0.3s ease",
              }}
            />
          )}

          {/* Full-size render wrapper: CSS scale only, no layout effect.
              html-to-image captures the inner ref div at full 600x360 px
              regardless of any visual scale applied here. */}
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
              background:   "linear-gradient(135deg,rgba(255,255,255,0.048) 0%,rgba(94,43,255,0.028) 100%)",
              border:       "1px solid rgba(183,132,255,0.24)",
              boxShadow:    "0 24px 80px rgba(0,0,0,0.88),0 0 0 1px rgba(255,255,255,0.018) inset",
              boxSizing:    "border-box",
            }}>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* EXPORTABLE CARD  600 x 360                                     */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div
                ref={cardRef}
                style={{
                  position:     "relative",
                  width:         CARD_W,
                  height:        CARD_H,
                  borderRadius:  12,
                  overflow:     "hidden",
                  background:   "linear-gradient(158deg,#050011 0%,#0a001e 55%,#04000e 100%)",
                  fontFamily:   "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                }}
              >

                {/* L0: Background glows ────────────────────────────────────── */}
                <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                  {/* Large bloom behind main profile */}
                  <div style={{
                    position: "absolute", left: "-8%", top: "-10%",
                    width: "62%", height: "120%", borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(94,43,255,0.32) 0%,rgba(80,28,160,0.14) 42%,transparent 72%)",
                    filter: "blur(40px)",
                  }} />
                  {/* Subtle ambient on right (card chain side) */}
                  <div style={{
                    position: "absolute", right: "-8%", top: "10%",
                    width: "55%", height: "80%", borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(55,18,108,0.18) 0%,transparent 72%)",
                    filter: "blur(32px)",
                  }} />
                  {/* Top centre soft bloom */}
                  <div style={{
                    position: "absolute", left: "20%", top: "-20%",
                    width: "60%", height: "50%", borderRadius: "50%",
                    background: "radial-gradient(circle,rgba(120,40,230,0.12) 0%,transparent 70%)",
                    filter: "blur(24px)",
                  }} />
                </div>

                {/* L1: Stars ──────────────────────────────────────────────── */}
                <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  {STARS.map((s) => (
                    <circle key={s.id} cx={`${s.cx}%`} cy={`${s.cy}%`} r={s.r} fill="white" opacity={s.o} />
                  ))}
                </svg>

                {/* L2: Chain SVG - connector lines + nodes (z=5, behind cards) */}
                <svg aria-hidden style={{
                  position: "absolute", inset: 0, width: "100%", height: "100%",
                  overflow: "visible", zIndex: 5, pointerEvents: "none",
                }}>
                  <defs>
                    <filter id="nglow" x="-140%" y="-140%" width="380%" height="380%">
                      <feGaussianBlur stdDeviation="3" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <linearGradient id="chainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="rgba(214,184,255,0.8)" />
                      <stop offset="50%"  stopColor="rgba(139,92,246,0.5)" />
                      <stop offset="100%" stopColor="rgba(94,43,255,0.18)" />
                    </linearGradient>
                  </defs>

                  {/* Decorative orbit rings around main profile */}
                  <circle cx={PROFILE_CX} cy={PROFILE_CY} r={58}
                    fill="none" stroke="rgba(183,132,255,0.1)" strokeWidth={0.6} strokeDasharray="2 10" />
                  <ellipse cx={PROFILE_CX} cy={PROFILE_CY} rx={95} ry={65}
                    fill="none" stroke="rgba(139,92,246,0.055)" strokeWidth={0.5} strokeDasharray="3 14" />

                  {/* Zig-zag chain: source to card 0, then each subsequent card */}
                  {predictions && predictions.length > 0 && (
                    <polyline
                      points={[
                        `${LINE_SRC_X},${LINE_SRC_Y}`,
                        ...CHAIN_NODES.slice(0, predictions.length).map((n) => `${n.x},${n.y}`),
                      ].join(" ")}
                      fill="none"
                      stroke="url(#chainGrad)"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.6"
                    />
                  )}

                  {/* Source node (right edge of main profile) */}
                  {predictions && predictions.length > 0 && (
                    <circle cx={LINE_SRC_X} cy={LINE_SRC_Y} r={3.2}
                      fill="rgba(214,184,255,0.9)" filter="url(#nglow)" />
                  )}

                  {/* Per-card connection nodes with category-matched color */}
                  {(predictions ?? []).map((acc, i) => {
                    const n   = CHAIN_NODES[i]; if (!n) return null;
                    const glw = categoryGlow(acc.category ?? "");
                    return (
                      <circle key={`n${i}`} cx={n.x} cy={n.y} r={2.4}
                        fill={glw.node}
                        filter="url(#nglow)"
                        opacity={0.78 - i * 0.06} />
                    );
                  })}
                </svg>

                {/* L3: Main profile (left anchor) ─────────────────────────── */}
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
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}
                  >
                    {/* Multi-ring avatar system */}
                    <div style={{ position: "relative", width: CENTER_SIZE + 22, height: CENTER_SIZE + 22 }}>

                      {/* Outer bloom */}
                      <div style={{
                        position: "absolute", inset: -24, borderRadius: "50%",
                        background: "radial-gradient(circle,rgba(139,92,246,0.55) 0%,rgba(94,43,255,0.2) 42%,transparent 72%)",
                        filter: "blur(18px)",
                      }} />

                      {/* Outer rotating arc ring */}
                      <motion.div
                        animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                        style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          borderTop:    "1.5px solid rgba(214,184,255,0.6)",
                          borderRight:  "1px solid rgba(139,92,246,0.22)",
                          borderBottom: "1px solid rgba(94,43,255,0.07)",
                          borderLeft:   "1px solid transparent",
                        }}
                      />

                      {/* Inner counter-rotating ring */}
                      <motion.div
                        animate={isCapturing ? { rotate: 0 } : { rotate: -360 }}
                        transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                        style={{
                          position: "absolute", inset: 6, borderRadius: "50%",
                          borderTop:    "1px solid rgba(183,132,255,0.24)",
                          borderLeft:   "1px solid rgba(168,85,247,0.12)",
                          borderRight:  "1px solid transparent",
                          borderBottom: "1px solid transparent",
                        }}
                      />

                      {/* Avatar container */}
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
                            background: "conic-gradient(from 0deg,#b784ff 0%,#6366f1 32%,#1e1b4b 58%,#b784ff 100%)",
                          }}
                        />
                        {/* Dark separator */}
                        <div style={{ position: "absolute", inset: 2, borderRadius: "50%", background: "#05030a" }} />
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
                            <div style={{ width: "100%", height: "100%", background: "rgba(139,92,246,0.1)" }} />
                          )}
                        </div>
                        {/* Ring glow overlay */}
                        <div style={{
                          position: "absolute", inset: 0, borderRadius: "50%",
                          boxShadow: "0 0 24px rgba(183,132,255,0.62),0 0 48px rgba(109,40,217,0.28)",
                          pointerEvents: "none",
                        }} />
                      </div>

                      {/* Diagonal glass reflection on avatar ring */}
                      <div aria-hidden style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        background: "linear-gradient(135deg,rgba(255,255,255,0.06) 0%,transparent 45%)",
                        pointerEvents: "none",
                      }} />
                    </div>

                    {/* Display name */}
                    <div style={{ textAlign: "center", marginTop: -3 }}>
                      <div style={{
                        color: "rgba(255,255,255,0.97)", fontSize: 12.5, fontWeight: 700,
                        letterSpacing: "0.022em", lineHeight: 1.2,
                        maxWidth: 124, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {searchedProfile?.displayName ?? "—"}
                      </div>
                      {/* Username - high contrast lavender */}
                      <div style={{
                        color: "rgba(196,168,255,0.84)", fontSize: 9.5, marginTop: 2.5,
                        letterSpacing: "0.014em", fontWeight: 500,
                      }}>
                        @{searchedProfile?.username ?? username ?? "—"}
                      </div>
                    </div>

                    {/* Orbit score badge */}
                    {searchedProfile && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 3,
                        padding: "3px 11px", borderRadius: 20,
                        background: "linear-gradient(135deg,rgba(94,43,255,0.42),rgba(79,70,229,0.28))",
                        border: "1px solid rgba(183,132,255,0.52)",
                        boxShadow: "0 0 16px rgba(139,92,246,0.36),0 1px 0 rgba(255,255,255,0.06) inset",
                      }}>
                        <span style={{
                          fontSize: 12, fontWeight: 900,
                          background: "linear-gradient(90deg,#d6b8ff,#7a6cff)",
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                        }}>
                          {formatScore(searchedProfile.score)}
                        </span>
                        <span style={{
                          fontSize: 7.5, color: "rgba(255,255,255,0.3)",
                          letterSpacing: "0.14em", textTransform: "uppercase",
                        }}>
                          Orbit
                        </span>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* L4: Suggestion cards - equal-size zig-zag chain ─────────── */}
                {(predictions ?? []).map((acc, i) => {
                  const pos = CHAIN_POS[i]; if (!pos) return null;
                  const tag = tagAccent(acc.category ?? "");
                  const glw = categoryGlow(acc.category ?? "");

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
                        {/* Glass card */}
                        <div style={{
                          position:             "relative",
                          width:                 CHAIN_W,
                          height:                CHAIN_H,
                          padding:              "8px 11px",
                          borderRadius:          10,
                          background:           "linear-gradient(155deg,rgba(24,14,40,0.62) 0%,rgba(8,4,22,0.78) 100%)",
                          border:               "1px solid rgba(183,132,255,0.48)",
                          boxShadow:            "0 6px 30px rgba(0,0,0,0.76),0 0 0 1px rgba(255,255,255,0.042) inset,0 0 22px rgba(94,43,255,0.2)",
                          backdropFilter:       "blur(24px)",
                          WebkitBackdropFilter: "blur(24px)",
                          display:              "flex",
                          flexDirection:        "column",
                          justifyContent:       "space-between",
                          overflow:             "hidden",
                        }}>

                          {/* Diagonal glass reflection streak */}
                          <div aria-hidden style={{
                            position: "absolute", top: 0, left: 0, right: 0, height: "42%",
                            background: "linear-gradient(135deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.018) 40%,transparent 70%)",
                            borderRadius: "10px 10px 0 0", pointerEvents: "none",
                          }} />

                          {/* Top edge bloom */}
                          <div aria-hidden style={{
                            position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
                            background: `linear-gradient(90deg,transparent,${glw.ring},transparent)`,
                            opacity: 0.55,
                          }} />

                          {/* Row A: avatar + name block */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative", zIndex: 1 }}>

                            {/* Avatar with per-category glow */}
                            <div style={{ position: "relative", flexShrink: 0 }}>
                              {/* Halo behind avatar */}
                              <div aria-hidden style={{
                                position: "absolute", inset: -4, borderRadius: "50%",
                                background: `radial-gradient(circle,${glw.halo} 0%,transparent 72%)`,
                                filter: "blur(5px)",
                              }} />
                              {/* Avatar circle */}
                              <div style={{
                                width:        28,
                                height:       28,
                                borderRadius: "50%",
                                overflow:     "hidden",
                                border:       `1px solid ${glw.ring}`,
                                background:   "linear-gradient(135deg,#3b0764,#1e1b4b)",
                                boxShadow:    `0 0 10px ${glw.halo}`,
                                position:     "relative",
                              }}>
                                <Image
                                  src={acc.avatar}
                                  alt={acc.name}
                                  width={28}
                                  height={28}
                                  className="object-cover w-full h-full"
                                  unoptimized
                                />
                                {/* Diagonal reflection on avatar */}
                                <div aria-hidden style={{
                                  position: "absolute", inset: 0, borderRadius: "50%",
                                  background: "linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 50%)",
                                  pointerEvents: "none",
                                }} />
                              </div>
                            </div>

                            {/* Name block */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Name + badge + follower count */}
                              <div style={{
                                display: "flex", alignItems: "center",
                                justifyContent: "space-between", gap: 4,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0, overflow: "hidden" }}>
                                  <span style={{
                                    color:        "rgba(255,255,255,0.95)",
                                    fontSize:      9,
                                    fontWeight:    700,
                                    whiteSpace:   "nowrap",
                                    overflow:     "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth:      100,
                                  }}>
                                    {acc.name}
                                  </span>
                                  {/* Blue verification badge */}
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
                                  color:      "rgba(160,140,200,0.68)",
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                }}>
                                  {formatFollowers(acc.followers)}
                                </span>
                              </div>
                              {/* Username - clearly readable lavender */}
                              <div style={{
                                fontSize:     7.5,
                                color:        "rgba(196,168,255,0.82)",
                                marginTop:    2,
                                fontWeight:   500,
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
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            gap: 4, position: "relative", zIndex: 1,
                          }}>
                            <span style={{
                              fontSize:             13,
                              fontWeight:           900,
                              letterSpacing:        "0.01em",
                              background:           "linear-gradient(90deg,#d6b8ff,#7a6cff)",
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

                {/* L5: Header bar */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "11px 16px",
                  background: "linear-gradient(180deg,rgba(5,3,10,0.96) 0%,transparent 100%)",
                  zIndex: 30, pointerEvents: "none",
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
                      background: "linear-gradient(90deg,#d6b8ff,#7a6cff)",
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

                {/* L6: Footer bar */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 16px",
                  background: "linear-gradient(0deg,rgba(5,3,10,0.96) 0%,transparent 100%)",
                  zIndex: 30, pointerEvents: "none",
                }}>
                  <span style={{
                    fontSize: 6.5, color: "rgba(255,255,255,0.13)",
                    letterSpacing: "0.12em", textTransform: "uppercase",
                  }}>
                    AI-Discovered Follow-Back Opportunities
                  </span>
                  <span style={{ fontSize: 6.5, color: "rgba(183,132,255,0.22)" }}>
                    followsignal.app · @mhknft
                  </span>
                </div>

                {/* Skeleton overlay while predictions load */}
                {predictions === null && (
                  <div style={{
                    position: "absolute", inset: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(5,3,10,0.5)", zIndex: 40,
                  }}>
                    <span style={{
                      fontSize: 9, letterSpacing: "0.25em", textTransform: "uppercase",
                      color: "rgba(183,132,255,0.38)",
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
        </motion.div>
        {/* /clickable wrapper */}

        {/* Tap-to-save hint label on mobile */}
        {canDownload && (
          <p className="text-center text-[10px] mt-2" style={{ color: "rgba(183,132,255,0.4)" }}>
            Tap card or button to save
          </p>
        )}
      </motion.div>

      {/* Download button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 1.9 }}
        className="flex flex-col items-center gap-3"
      >
        <motion.button
          onClick={handleDownload}
          disabled={!canDownload}
          whileHover={canDownload ? { scale: 1.04 } : {}}
          whileTap={canDownload  ? { scale: 0.97 } : {}}
          className="relative px-10 py-4 rounded-2xl font-bold text-sm tracking-wide text-white overflow-hidden group"
          style={{
            background: isExporting
              ? "linear-gradient(135deg,#3b1a7a,#2e2a7a)"
              : "linear-gradient(135deg,#5e2bff 0%,#6d28d9 50%,#4f46e5 100%)",
            boxShadow:  "0 0 0 1px rgba(183,132,255,0.3),0 8px 32px rgba(94,43,255,0.42),0 2px 0 rgba(255,255,255,0.1) inset",
            opacity:    predictions === null ? 0.45 : 1,
            cursor:     canDownload ? "pointer" : "default",
          }}
        >
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.14) 0%,transparent 60%)" }}
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
