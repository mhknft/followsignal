"use client";

import { use } from "react";
import Background from "../../components/Background";
import ParticleField from "../../components/ParticleField";
import Navbar from "../../components/Navbar";
import ConstellationLayout from "../../components/ConstellationLayout";
import ShareCard from "../../components/ShareCard";

interface Props {
  params: Promise<{ username: string }>;
}

export default function ResultsPage({ params }: Props) {
  const { username } = use(params);

  return (
    <main className="relative min-h-screen bg-black overflow-x-hidden">
      <Background />
      <ParticleField />
      <Navbar />

      <section className="relative" style={{ minHeight: "100vh" }}>
        <ConstellationLayout username={username} />
      </section>

      <ShareCard username={username} />

      {/* Creator credit */}
      <div className="fixed bottom-5 right-6 z-50">
        <a
          href="https://x.com/mhknft"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 transition-all duration-300"
          style={{ textDecoration: "none" }}
        >
          <span className="text-[10px] tracking-wide" style={{ color: "rgba(180,160,220,0.62)" }}>
            Built by
          </span>
          <span
            className="text-[10px] font-medium tracking-wide transition-all duration-300 group-hover:translate-y-[-2px] group-hover:text-purple-300 group-hover:[text-shadow:0_0_10px_rgba(168,85,247,0.6)] inline-block"
            style={{ color: "rgba(192,168,240,0.65)" }}
          >
            @mhknft
          </span>
        </a>
      </div>
    </main>
  );
}
