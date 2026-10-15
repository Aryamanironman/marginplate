'use client';

import { useEffect, useRef } from 'react';

export default function Home() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const { innerWidth, innerHeight } = window;
      const x = (e.clientX / innerWidth - 0.5) * 2;
      const y = (e.clientY / innerHeight - 0.5) * 2;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        scene.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 8}deg)`;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center py-20 overflow-hidden">
      {/* CSS-3D hero scene */}
      <div className="relative h-[340px] w-full max-w-2xl [perspective:1400px]" aria-hidden>
        <div
          ref={sceneRef}
          className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-200 ease-out"
        >
          {/* back plate */}
          <div className="absolute left-1/2 top-1/2 h-44 w-72 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-paper-deep shadow-xl [transform:translateZ(-90px)rotateX(8deg)rotateY(-14deg)]" />
          {/* mid plate */}
          <div className="absolute left-1/2 top-1/2 h-48 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface shadow-xl [transform:translateZ(0px)rotateX(4deg)rotateY(-6deg)]">
            <div className="flex h-full flex-col justify-between p-5">
              <div className="label-mono text-[11px] uppercase tracking-widest text-ink-faint">
                Grilled Chicken Plate
              </div>
              <div>
                <div className="font-display text-3xl font-semibold text-ink">$2.85 <span className="text-lg text-ink-faint">/lb</span></div>
                <div className="mt-1 label-mono text-[11px] text-corten">▲ 14% since last order</div>
              </div>
            </div>
          </div>
          {/* front card */}
          <div className="absolute left-1/2 top-1/2 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-corten text-on-corten shadow-xl [transform:translateZ(80px)rotateX(-6deg)rotateY(10deg)]">
            <div className="flex h-full flex-col justify-between p-5">
              <div className="label-mono text-[11px] uppercase tracking-widest text-on-corten/80">Food cost</div>
              <div>
                <div className="font-display text-4xl font-semibold">18.8%</div>
                <div className="mt-1 label-mono text-[11px] text-on-corten/80">▲ under 30% target · watchlist 6</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* copy */}
      <div className="relative z-10 mt-8 max-w-xl text-center">
        <p className="label-mono mb-4 text-[11px] uppercase tracking-[0.2em] text-corten">Food-cost watchdog</p>
        <h1 className="text-4xl sm:text-5xl font-semibold text-ink leading-tight">
          Which dishes quietly lose money when rates move?
        </h1>
        <p className="mt-4 text-ink-muted leading-relaxed">
          Photograph a supplier invoice. MarginPlate normalizes the units, recomputes cost per plate,
          and flags every ingredient whose price has crept up — with the dollar impact shown.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href="/login"
            className="rounded-full bg-corten px-7 py-3 text-sm font-medium text-on-corten transition-colors hover:bg-corten-hover"
          >
            Launch live demo
          </a>
          <a
            href="https://github.com/Aryamanironman/marginplate"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-7 py-3 text-sm font-medium text-ink transition-colors hover:border-corten hover:text-corten"
          >
            View source
          </a>
        </div>
        <p className="mt-6 label-mono text-xs text-ink-faint">
          demo: maria@test.dev · DemoPass2026!
        </p>
      </div>
    </div>
  );
}
