"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export default function OrbitalScanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SIZE = 260;
    canvas.width = SIZE;
    canvas.height = SIZE;
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    let angle = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      angle += 0.022;

      // ── Static orbit rings ──
      const rings = [
        { r: 110, opacity: 0.07 },
        { r: 80,  opacity: 0.1 },
        { r: 52,  opacity: 0.14 },
      ];
      rings.forEach(({ r, opacity }) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(168,85,247,${opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // ── Radar sweep ──
      const sweepLen = Math.PI * 0.9;
      // Draw the sweep as a filled arc sector
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      const sweep = ctx.createRadialGradient(0, 0, 0, 0, 0, 115);
      sweep.addColorStop(0, "rgba(168,85,247,0)");
      sweep.addColorStop(0.4, "rgba(168,85,247,0.08)");
      sweep.addColorStop(1, "rgba(168,85,247,0)");
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 115, -sweepLen, 0);
      ctx.closePath();
      ctx.fillStyle = sweep;
      ctx.fill();
      ctx.restore();

      // ── Rotating bright dot on outer ring ──
      const dotX = cx + Math.cos(angle) * 110;
      const dotY = cy + Math.sin(angle) * 110;
      const dotGlow = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 12);
      dotGlow.addColorStop(0, "rgba(220,170,255,0.95)");
      dotGlow.addColorStop(0.4, "rgba(168,85,247,0.5)");
      dotGlow.addColorStop(1, "rgba(168,85,247,0)");
      ctx.fillStyle = dotGlow;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(240,210,255,1)";
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // ── Rotating dot on mid ring (offset phase) ──
      const dot2X = cx + Math.cos(-angle * 0.7 + Math.PI) * 80;
      const dot2Y = cy + Math.sin(-angle * 0.7 + Math.PI) * 80;
      const dot2Glow = ctx.createRadialGradient(dot2X, dot2Y, 0, dot2X, dot2Y, 7);
      dot2Glow.addColorStop(0, "rgba(192,132,252,0.8)");
      dot2Glow.addColorStop(1, "rgba(168,85,247,0)");
      ctx.fillStyle = dot2Glow;
      ctx.beginPath();
      ctx.arc(dot2X, dot2Y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(220,180,255,0.9)";
      ctx.beginPath();
      ctx.arc(dot2X, dot2Y, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // ── Center core pulse — drawn in CSS, skip here ──

      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Center glowing core */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse halo */}
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
          className="absolute rounded-full"
          style={{
            width: 64,
            height: 64,
            background: "radial-gradient(circle, rgba(168,85,247,0.5) 0%, transparent 70%)",
          }}
        />
        {/* Mid halo */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
          className="absolute rounded-full"
          style={{
            width: 44,
            height: 44,
            border: "1px solid rgba(168,85,247,0.5)",
          }}
        />
        {/* Core */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            boxShadow: "0 0 20px rgba(168,85,247,0.7), 0 0 40px rgba(139,92,246,0.3)",
          }}
        >
          {/* FS icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" fill="white" />
            <circle cx="7" cy="2.5" r="1" fill="rgba(255,255,255,0.7)" />
            <circle cx="7" cy="11.5" r="1" fill="rgba(255,255,255,0.7)" />
            <circle cx="2.5" cy="7" r="1" fill="rgba(255,255,255,0.7)" />
            <circle cx="11.5" cy="7" r="1" fill="rgba(255,255,255,0.7)" />
          </svg>
        </motion.div>
      </div>
    </div>
  );
}
