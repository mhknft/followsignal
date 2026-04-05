"use client";

import { motion } from "framer-motion";

export default function Background() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* ── Base gradient ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, #020009 0%, #06001c 25%, #0c0028 55%, #060015 80%, #010008 100%)",
        }}
      />

      {/* ── GIANT center orb — primary bloom ── */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.95, 0.7] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        className="absolute"
        style={{
          width: "80vw",
          height: "80vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.42) 0%, rgba(109,40,217,0.22) 35%, rgba(88,28,235,0.08) 60%, transparent 75%)",
          filter: "blur(55px)",
          left: "50%",
          top: "42%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* ── Bright inner core orb ── */}
      <motion.div
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute"
        style={{
          width: "30vw",
          height: "30vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.5) 0%, rgba(139,92,246,0.25) 40%, transparent 70%)",
          filter: "blur(35px)",
          left: "50%",
          top: "38%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* ── Upper-left violet bloom ── */}
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute"
        style={{
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(124,58,237,0.28) 0%, rgba(109,40,217,0.1) 50%, transparent 70%)",
          filter: "blur(80px)",
          left: "-12%",
          top: "-8%",
        }}
      />

      {/* ── Bottom-right cyan accent ── */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.18, 0.35, 0.18] }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute"
        style={{
          width: "38vw",
          height: "38vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(34,211,238,0.22) 0%, rgba(99,102,241,0.12) 45%, transparent 70%)",
          filter: "blur(65px)",
          right: "-6%",
          bottom: "-6%",
        }}
      />

      {/* ── Top-right indigo accent ── */}
      <motion.div
        animate={{ opacity: [0.2, 0.38, 0.2] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute"
        style={{
          width: "32vw",
          height: "32vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 70%)",
          filter: "blur(60px)",
          right: "4%",
          top: "3%",
        }}
      />

      {/* ── Lower-left deep violet ── */}
      <div
        className="absolute"
        style={{
          width: "28vw",
          height: "28vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(109,40,217,0.18) 0%, transparent 70%)",
          filter: "blur(55px)",
          left: "-4%",
          bottom: "8%",
        }}
      />

      {/* ── Orbit rings anchored to hero position (~38% from top) ── */}
      <div
        className="absolute left-1/2"
        style={{ top: "38%", transform: "translate(-50%, -50%)" }}
      >
        {[
          { size: 200, opacity: 0.09, duration: 50 },
          { size: 340, opacity: 0.06, duration: 70 },
          { size: 490, opacity: 0.04, duration: 95 },
          { size: 640, opacity: 0.025, duration: 120 },
        ].map(({ size, opacity, duration }, i) => (
          <motion.div
            key={i}
            animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
            transition={{ duration, repeat: Infinity, ease: "linear" }}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              border: `1px solid rgba(168,92,246,${opacity})`,
              left: -size / 2,
              top: -size / 2,
              boxShadow: `0 0 ${6 + i * 2}px rgba(139,92,246,${opacity * 0.8})`,
            }}
          />
        ))}

        {/* Dash-dotted accent ring */}
        <div
          className="absolute rounded-full"
          style={{
            width: 270,
            height: 270,
            border: "1px dashed rgba(139,92,246,0.07)",
            left: -135,
            top: -135,
          }}
        />
      </div>

      {/* ── Grain noise ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "160px 160px",
          opacity: 0.032,
          mixBlendMode: "overlay",
        }}
      />

      {/* ── Edge vignette ── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(0,0,10,0.65) 80%, rgba(0,0,10,0.88) 100%)",
        }}
      />
    </div>
  );
}
