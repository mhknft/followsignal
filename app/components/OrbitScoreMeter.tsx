"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface OrbitScoreMeterProps {
  score: number;
}

export default function OrbitScoreMeter({ score }: OrbitScoreMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 140;
    canvas.width = size;
    canvas.height = size;

    let progress = 0;
    const target = score / 100;
    let timeOffset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      timeOffset += 0.02;

      const cx = size / 2;
      const cy = size / 2;
      const radius = 54;

      // Background arc
      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI * 1.5);
      ctx.strokeStyle = "rgba(139, 92, 246, 0.12)";
      ctx.lineWidth = 6;
      ctx.stroke();

      // Outer glow ring
      const pulseScale = 0.03 * Math.sin(timeOffset);
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 8 + pulseScale * 10, -Math.PI / 2, Math.PI * 1.5);
      ctx.strokeStyle = `rgba(139, 92, 246, ${0.06 + 0.04 * Math.sin(timeOffset)})`;
      ctx.lineWidth = 14;
      ctx.stroke();

      // Progress arc
      if (progress < target) {
        progress += 0.015;
      }

      const endAngle = -Math.PI / 2 + Math.PI * 2 * Math.min(progress, target);

      ctx.beginPath();
      ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle);
      ctx.strokeStyle = "rgba(168, 85, 247, 0.9)";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(168, 85, 247, 0.8)";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tip glow dot
      const tipX = cx + Math.cos(endAngle) * radius;
      const tipY = cy + Math.sin(endAngle) * radius;
      const dotGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 10);
      dotGrad.addColorStop(0, "rgba(220, 180, 255, 1)");
      dotGrad.addColorStop(0.4, "rgba(168, 85, 247, 0.6)");
      dotGrad.addColorStop(1, "rgba(168, 85, 247, 0)");
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 10, 0, Math.PI * 2);
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: 140, height: 140 }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center">
        <motion.span
          className="text-3xl font-bold text-white"
          style={{ textShadow: "0 0 20px rgba(168,85,247,0.8)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] tracking-widest text-purple-300 uppercase mt-0.5">
          Orbit Score
        </span>
      </div>
    </div>
  );
}
