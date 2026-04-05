"use client";

import { useEffect, useRef } from "react";

interface Connection {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
}

interface OrbitLinesProps {
  connections: Connection[];
}

// Two particles travel per line at different speeds/offsets
const PARTICLES_PER_LINE = 2;

export default function OrbitLines({ connections }: OrbitLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      timeRef.current += 0.007;
      const t0 = timeRef.current;

      connections.forEach((conn, index) => {
        // Control point arcs slightly above midpoint
        const arcLift = 50 + (index % 3) * 20;
        const midX = (conn.fromX + conn.toX) / 2;
        const midY = (conn.fromY + conn.toY) / 2;
        // Perpendicular offset for the control point
        const dx = conn.toX - conn.fromX;
        const dy = conn.toY - conn.fromY;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const cx = midX - (dy / len) * arcLift;
        const cy = midY + (dx / len) * arcLift * 0.4 - arcLift * 0.6;

        // ── Main glow line (wide, soft) ──
        ctx.beginPath();
        ctx.moveTo(conn.fromX, conn.fromY);
        ctx.quadraticCurveTo(cx, cy, conn.toX, conn.toY);
        const lineGrad = ctx.createLinearGradient(conn.fromX, conn.fromY, conn.toX, conn.toY);
        lineGrad.addColorStop(0,   "rgba(168, 85, 247, 0.0)");
        lineGrad.addColorStop(0.35, "rgba(192,132,252, 0.55)");
        lineGrad.addColorStop(0.65, "rgba(192,132,252, 0.55)");
        lineGrad.addColorStop(1,   "rgba(168, 85, 247, 0.0)");
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = "rgba(168,85,247,0.6)";
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // ── Thin sharp line on top ──
        ctx.beginPath();
        ctx.moveTo(conn.fromX, conn.fromY);
        ctx.quadraticCurveTo(cx, cy, conn.toX, conn.toY);
        ctx.strokeStyle = "rgba(220, 180, 255, 0.25)";
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // ── Animated particles ──
        for (let p = 0; p < PARTICLES_PER_LINE; p++) {
          const speed = 0.28 + p * 0.12 + index * 0.04;
          const phaseOffset = p * (1 / PARTICLES_PER_LINE) + index * 0.15;
          const t = ((t0 * speed + phaseOffset) % 1);

          // Quadratic Bezier point
          const px = (1 - t) * (1 - t) * conn.fromX + 2 * (1 - t) * t * cx + t * t * conn.toX;
          const py = (1 - t) * (1 - t) * conn.fromY + 2 * (1 - t) * t * cy + t * t * conn.toY;

          // Fade in/out near endpoints
          const edgeFade = Math.min(t * 8, 1) * Math.min((1 - t) * 8, 1);

          // Outer glow
          const r1 = 10 + p * 2;
          const outerGlow = ctx.createRadialGradient(px, py, 0, px, py, r1);
          outerGlow.addColorStop(0, `rgba(220, 170, 255, ${0.75 * edgeFade})`);
          outerGlow.addColorStop(0.3, `rgba(168, 85, 247, ${0.45 * edgeFade})`);
          outerGlow.addColorStop(1, "rgba(168, 85, 247, 0)");
          ctx.fillStyle = outerGlow;
          ctx.beginPath();
          ctx.arc(px, py, r1, 0, Math.PI * 2);
          ctx.fill();

          // Core bright dot
          ctx.fillStyle = `rgba(240, 210, 255, ${edgeFade})`;
          ctx.shadowColor = "rgba(200, 150, 255, 0.9)";
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(px, py, 2 + p * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
    };
  }, [connections]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-10"
    />
  );
}
