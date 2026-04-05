"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { PredictedAccount, SearchedProfile } from "../types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatScore(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toString();
}

// ─── Layout constants ────────────────────────────────────────────────────────

const CARD_W = 520;
const CARD_H = 340;

// Center of the constellation (as %)
const CX = 50;
const CY = 44;

// Orbit positions for each recommendation card (% of card width / height)
const ORBIT_POS: Record<string, { x: number; y: number }> = {
  "top-left":      { x: 20, y: 14 },
  "top-right":     { x: 80, y: 14 },
  "lower-left":    { x: 12, y: 75 },
  "lower-right":   { x: 88, y: 75 },
  "bottom-center": { x: 50, y: 90 },
};

// ─── Background stars (deterministic — same every render) ───────────────────

const STARS = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  x: ((i * 137.508) % 100).toFixed(2),
  y: ((i * 97.391 + 13) % 100).toFixed(2),
  r: i % 4 === 0 ? 1.4 : i % 4 === 1 ? 1.0 : i % 4 === 2 ? 0.7 : 0.5,
  o: (0.12 + (i % 6) * 0.055).toFixed(3),
}));

// ─── Component ───────────────────────────────────────────────────────────────

interface ShareCardProps {
  username?: string;
  predictions: PredictedAccount[] | null;
  searchedProfile?: SearchedProfile | null;
}

export default function ShareCard({ username, predictions, searchedProfile }: ShareCardProps) {
  const cardRef      = useRef<HTMLDivElement>(null);
  const [isExporting,  setIsExporting]  = useState(false);
  const [isCapturing,  setIsCapturing]  = useState(false);
  const [exportError,  setExportError]  = useState(false);

  // ── Image proxy (avoids CORS during export) ────────────────────────────────
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

  // ── Export handler ─────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    const el = cardRef.current;
    if (!el || isExporting) return;

    setIsExporting(true);
    setExportError(false);

    const imgs     = Array.from(el.querySelectorAll("img")) as HTMLImageElement[];
    const origSrcs = imgs.map((img) => img.src);

    try {
      // Pre-fetch every avatar through the server proxy → base64 data URL.
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
          } catch { /* leave original src — placeholder will show */ }
        }),
      );

      // Freeze all Framer Motion animations to their rest position.
      setIsCapturing(true);
      await new Promise<void>((r) => setTimeout(r, 120));

      const { toPng } = await import("html-to-image");
      const pixelRatio = Math.max(2, 1200 / el.offsetWidth);

      const dataUrl = await toPng(el, {
        cacheBust:        false,
        pixelRatio,
        imagePlaceholder: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=",
      });

      setIsCapturing(false);

      const link = document.createElement("a");
      link.download = `followsignal-${username ?? "card"}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError(true);
      setIsCapturing(false);
    } finally {
      imgs.forEach((img, i) => { img.src = origSrcs[i]; });
      setIsExporting(false);
    }
  }, [isExporting, username]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <section className="relative z-30 mt-24 mb-16 flex flex-col items-center px-4">

      {/* ── Section label ──────────────────────────────────────────────────── */}
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

      {/* ── Card preview ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 1, delay: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
        style={{ maxWidth: "100%" }}
      >
        {/* Outer glow halo */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.55) 0%, transparent 70%)",
            filter: "blur(48px)",
            transform: "scale(1.3)",
            zIndex: -1,
          }}
        />

        {/* Glass frame */}
        <div
          className="p-[10px] rounded-3xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(139,92,246,0.04) 100%)",
            border: "1px solid rgba(139,92,246,0.3)",
            boxShadow: "0 12px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
          }}
        >

          {/* ── The actual exportable card ──────────────────────────────── */}
          <div
            ref={cardRef}
            style={{
              position: "relative",
              width: CARD_W,
              height: CARD_H,
              maxWidth: "100%",
              borderRadius: 14,
              overflow: "hidden",
              background: "linear-gradient(150deg, #07000e 0%, #110022 45%, #08001a 100%)",
            }}
          >

            {/* ── Layer 0: Stars ─────────────────────────────────────────── */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              aria-hidden="true"
            >
              {STARS.map((s) => (
                <circle key={s.id} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white" opacity={s.o} />
              ))}
            </svg>

            {/* ── Layer 1: Radial background glow behind center ─────────── */}
            <div
              style={{
                position: "absolute",
                left: `${CX}%`,
                top: `${CY}%`,
                transform: "translate(-50%, -50%)",
                width: 280,
                height: 280,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(120,40,240,0.45) 0%, rgba(80,20,180,0.18) 45%, transparent 70%)",
                filter: "blur(18px)",
                pointerEvents: "none",
              }}
            />

            {/* ── Layer 2: Orbit lines (SVG) ─────────────────────────────── */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              aria-hidden="true"
            >
              <defs>
                {(predictions ?? []).map((acc, i) => {
                  const pos = ORBIT_POS[acc.position] ?? { x: 50, y: 50 };
                  return (
                    <linearGradient
                      key={`grad-${i}`}
                      id={`lg${i}`}
                      x1={`${CX}%`} y1={`${CY}%`}
                      x2={`${pos.x}%`} y2={`${pos.y}%`}
                      gradientUnits="userSpaceOnUse"
                    >
                      <stop offset="0%"   stopColor="rgba(168,85,247,0.9)" />
                      <stop offset="60%"  stopColor="rgba(139,92,246,0.35)" />
                      <stop offset="100%" stopColor="rgba(99,102,241,0.15)" />
                    </linearGradient>
                  );
                })}
              </defs>

              {(predictions ?? []).map((acc, i) => {
                const pos = ORBIT_POS[acc.position] ?? { x: 50, y: 50 };
                const x1 = (CX / 100) * CARD_W;
                const y1 = (CY / 100) * CARD_H;
                const x2 = (pos.x / 100) * CARD_W;
                const y2 = (pos.y / 100) * CARD_H;
                return (
                  <g key={`line-${i}`}>
                    {/* Solid gradient line */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={`url(#lg${i})`}
                      strokeWidth="0.9"
                    />
                    {/* Dashed overlay for depth */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="rgba(168,85,247,0.25)"
                      strokeWidth="0.6"
                      strokeDasharray="3 7"
                    />
                  </g>
                );
              })}
            </svg>

            {/* ── Layer 3: Center profile ────────────────────────────────── */}
            <motion.div
              style={{
                position: "absolute",
                left: `${CX}%`,
                top: `${CY}%`,
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                zIndex: 20,
              }}
              animate={isCapturing ? { y: 0 } : { y: [0, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Profile ring + avatar */}
              <div style={{ position: "relative", width: 94, height: 94 }}>
                {/* Rotating conic-gradient ring */}
                <motion.div
                  style={{
                    position: "absolute",
                    inset: -2,
                    borderRadius: "50%",
                    background: "conic-gradient(from 0deg, #a855f7 0%, #6366f1 30%, #1e1b4b 55%, #a855f7 100%)",
                  }}
                  animate={isCapturing ? { rotate: 0 } : { rotate: 360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                />
                {/* Dark inset separator */}
                <div
                  style={{
                    position: "absolute",
                    inset: 2,
                    borderRadius: "50%",
                    background: "#07000e",
                  }}
                />
                {/* Avatar */}
                <div
                  style={{
                    position: "absolute",
                    inset: 5,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "linear-gradient(135deg, #4c1d95, #1e1b4b)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {searchedProfile?.avatar ? (
                    <Image
                      src={searchedProfile.avatar}
                      alt={searchedProfile.displayName}
                      width={84}
                      height={84}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : searchedProfile ? (
                    <span style={{ color: "white", fontSize: 26, fontWeight: 900 }}>
                      {searchedProfile.displayName.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "rgba(168,85,247,0.08)" }} />
                  )}
                </div>
                {/* Outer glow shadow */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    boxShadow: "0 0 24px rgba(168,85,247,0.65), 0 0 48px rgba(139,92,246,0.28)",
                    pointerEvents: "none",
                  }}
                />
              </div>

              {/* Name */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  color: "white",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  lineHeight: 1.2,
                }}>
                  {searchedProfile?.displayName ?? "—"}
                </div>
                <div style={{ color: "rgba(168,85,247,0.55)", fontSize: 9, marginTop: 1 }}>
                  @{searchedProfile?.username ?? username ?? "—"}
                </div>
              </div>

              {/* Orbit Score badge */}
              {searchedProfile && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "3px 9px",
                  borderRadius: 20,
                  background: "linear-gradient(135deg, rgba(109,40,217,0.35), rgba(79,70,229,0.25))",
                  border: "1px solid rgba(139,92,246,0.55)",
                  boxShadow: "0 0 14px rgba(139,92,246,0.35), 0 2px 0 rgba(255,255,255,0.04) inset",
                }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 900,
                    background: "linear-gradient(90deg, #c084fc, #818cf8)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}>
                    {formatScore(searchedProfile.score)}
                  </span>
                  <span style={{
                    fontSize: 7.5,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                  }}>
                    Orbit
                  </span>
                </div>
              )}
            </motion.div>

            {/* ── Layer 4: Recommendation cards ─────────────────────────── */}
            {(predictions ?? []).map((acc, i) => {
              const pos = ORBIT_POS[acc.position] ?? { x: 50, y: 50 };
              return (
                <motion.div
                  key={acc.id}
                  style={{
                    position: "absolute",
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: "translate(-50%, -50%)",
                    zIndex: 20,
                  }}
                  animate={isCapturing ? { y: 0 } : { y: [0, -2.5, 0] }}
                  transition={{
                    duration: 3.5 + i * 0.45,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.4,
                  }}
                  whileHover={{ scale: 1.07, transition: { duration: 0.18 } }}
                >
                  {/* Mini card */}
                  <div
                    style={{
                      width: 106,
                      padding: "7px 8px 8px",
                      borderRadius: 10,
                      background: "linear-gradient(145deg, rgba(100,36,210,0.28) 0%, rgba(20,14,60,0.5) 100%)",
                      border: "1px solid rgba(139,92,246,0.45)",
                      boxShadow:
                        "0 6px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 16px rgba(109,40,217,0.18)",
                    }}
                  >
                    {/* Avatar + name row */}
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                      {/* Avatar */}
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "1px solid rgba(139,92,246,0.45)",
                        background: "linear-gradient(135deg, #4c1d95, #1e1b4b)",
                      }}>
                        <Image
                          src={acc.avatar}
                          alt={acc.name}
                          width={24}
                          height={24}
                          className="object-cover w-full h-full"
                          unoptimized
                        />
                      </div>
                      {/* Name + username */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          color: "rgba(255,255,255,0.92)",
                          fontSize: 8,
                          fontWeight: 700,
                          lineHeight: 1.25,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {acc.name}
                        </div>
                        <div style={{
                          color: "rgba(168,85,247,0.52)",
                          fontSize: 7,
                          lineHeight: 1.2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}>
                          {acc.username}
                        </div>
                      </div>
                    </div>

                    {/* Score + category */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 900,
                        letterSpacing: "0.01em",
                        background: "linear-gradient(90deg, #c084fc, #818cf8)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        flexShrink: 0,
                      }}>
                        {acc.score != null ? formatScore(acc.score) : `${acc.matchPercent}%`}
                      </span>
                      <span style={{
                        fontSize: 6,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        padding: "1.5px 5px",
                        borderRadius: 20,
                        whiteSpace: "nowrap",
                        background: acc.isWildcard
                          ? "rgba(168,85,247,0.28)"
                          : "rgba(79,70,229,0.22)",
                        border: acc.isWildcard
                          ? "1px solid rgba(168,85,247,0.55)"
                          : "1px solid rgba(99,102,241,0.4)",
                        color: acc.isWildcard
                          ? "rgba(220,180,255,0.9)"
                          : "rgba(165,140,250,0.85)",
                      }}>
                        {acc.category}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* ── Layer 5: Header bar ────────────────────────────────────── */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "linear-gradient(180deg, rgba(7,0,14,0.85) 0%, transparent 100%)",
                zIndex: 30,
                pointerEvents: "none",
              }}
            >
              {/* Logo */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 17,
                  height: 17,
                  borderRadius: 5,
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow: "0 0 8px rgba(124,58,237,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                    <circle cx="5" cy="5" r="1.5" fill="white" />
                    <circle cx="5" cy="1.5" r="0.9" fill="rgba(255,255,255,0.7)" />
                    <circle cx="5" cy="8.5" r="0.9" fill="rgba(255,255,255,0.7)" />
                    <circle cx="1.5" cy="5" r="0.9" fill="rgba(255,255,255,0.7)" />
                    <circle cx="8.5" cy="5" r="0.9" fill="rgba(255,255,255,0.7)" />
                  </svg>
                </div>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "linear-gradient(90deg, #c084fc, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  FollowSignal
                </span>
              </div>
              <span style={{
                fontSize: 7.5,
                color: "rgba(255,255,255,0.22)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}>
                AI Network Scan
              </span>
            </div>

            {/* ── Layer 6: Footer ────────────────────────────────────────── */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 14px",
                background: "linear-gradient(0deg, rgba(7,0,14,0.85) 0%, transparent 100%)",
                zIndex: 30,
                pointerEvents: "none",
              }}
            >
              <span style={{
                fontSize: 7,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}>
                AI Discovered These Follow-Back Opportunities
              </span>
              <span style={{ fontSize: 7, color: "rgba(180,155,230,0.32)" }}>
                Built by @mhknft
              </span>
            </div>

            {/* ── Skeleton / loading overlay ─────────────────────────────── */}
            {predictions === null && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(7,0,14,0.55)",
                zIndex: 40,
              }}>
                <span style={{
                  fontSize: 10,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(168,85,247,0.45)",
                }}>
                  Scanning…
                </span>
              </div>
            )}

          </div>
          {/* /exportable card */}

        </div>
      </motion.div>

      {/* ── Download button ─────────────────────────────────────────────────── */}
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
          whileTap={isExporting || predictions === null ? {} : { scale: 0.97 }}
          className="relative px-10 py-4 rounded-2xl font-bold text-sm tracking-wide text-white overflow-hidden group"
          style={{
            background: isExporting
              ? "linear-gradient(135deg, #4c1d95, #3730a3)"
              : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #4f46e5 100%)",
            boxShadow:
              "0 0 0 1px rgba(168,85,247,0.3), 0 8px 32px rgba(109,40,217,0.4), 0 2px 0 rgba(255,255,255,0.1) inset",
            opacity: predictions === null ? 0.45 : 1,
            cursor: isExporting || predictions === null ? "default" : "pointer",
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
