"use client";

import { useEffect, useRef } from "react";

/**
 * Falling snow for the winter skin — a single fixed canvas mounted once by the
 * root layout, and only when <html data-theme="winter">.
 *
 * Why canvas and not CSS: a believable fall needs ~90 flakes each with its own
 * size, speed, sway phase and depth. As DOM nodes that is 90 composited layers
 * animating every frame; on one canvas it is one layer and a handful of fills.
 *
 * Behaviour notes:
 *  · three depth bands — far flakes are small, dim and slow, near ones large,
 *    bright and fast, which is what reads as depth rather than noise;
 *  · the wind drifts on its own slow sine, so the whole field leans together
 *    instead of every flake wobbling independently;
 *  · density scales with viewport area and is capped, so a phone is not asked
 *    to paint a desktop's worth of snow;
 *  · prefers-reduced-motion renders nothing at all, and a hidden tab drops the
 *    animation frame instead of burning battery behind another window.
 */

type Flake = {
  x: number;
  y: number;
  r: number; // radius in CSS px
  speed: number; // px per second, downward
  sway: number; // px of horizontal travel
  phase: number; // sway offset so flakes never sync
  spin: number; // radians per second (crystals only)
  angle: number;
  alpha: number;
  crystal: boolean;
};

const MAX_FLAKES = 110;
const AREA_PER_FLAKE = 17000; // px² of viewport per flake

export default function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let flakes: Flake[] = [];
    let raf = 0;
    let last = 0;
    let wind = 0;
    let width = 0;
    let height = 0;

    const make = (seeded: boolean): Flake => {
      // depth: 0 = far, 1 = near
      const depth = Math.random();
      const r = 0.8 + depth * 2.9;
      return {
        x: Math.random() * width,
        y: seeded ? Math.random() * height : -r * 4 - Math.random() * 60,
        r,
        speed: 14 + depth * 46,
        sway: 8 + depth * 26,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.2,
        angle: Math.random() * Math.PI,
        alpha: 0.3 + depth * 0.55,
        // the biggest flakes only — drawing every one as a crystal costs far
        // more than it shows at 2px
        crystal: r > 2.9 && Math.random() < 0.55,
      };
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(MAX_FLAKES, Math.round((width * height) / AREA_PER_FLAKE));
      if (flakes.length > target) flakes.length = target;
      while (flakes.length < target) flakes.push(make(true));
    };

    const drawCrystal = (f: Flake) => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.strokeStyle = `rgba(255,255,255,${f.alpha})`;
      ctx.lineWidth = Math.max(0.6, f.r * 0.3);
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        const dx = Math.cos(a) * f.r * 1.7;
        const dy = Math.sin(a) * f.r * 1.7;
        ctx.moveTo(-dx, -dy);
        ctx.lineTo(dx, dy);
      }
      ctx.stroke();
      ctx.restore();
    };

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); // clamp: tab wake-ups
      last = now;
      // one slow sine for the whole field — a gust, not 90 separate wobbles
      wind = Math.sin(now / 4200) * 18 + Math.sin(now / 1700) * 6;

      ctx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        f.y += f.speed * dt;
        f.phase += dt * 0.9;
        f.angle += f.spin * dt;
        const x = f.x + Math.sin(f.phase) * f.sway + wind * (f.r / 3.7);
        // The skin lights the page from one cold pool at the top centre (see
        // .wn-stage in winter-theme.css) — a flake outside it is in shadow, so
        // its alpha falls away with its distance from that source.
        const lit =
          0.46 +
          0.54 *
            Math.max(
              0,
              1 - Math.hypot((x - width / 2) / (width * 0.62), f.y / (height * 0.95)),
            );
        const alpha = f.alpha * lit;

        if (f.crystal) {
          drawCrystal({ ...f, x, alpha });
        } else {
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }

        // recycle off the bottom (and off the sides, once the wind has carried
        // a flake out of frame for good)
        if (f.y - f.r > height || x < -80 || x > width + 80) {
          Object.assign(f, make(false));
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (raf || reduced.matches || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onVisibility = () => (document.hidden ? stop() : start());
    const onMotionChange = () => {
      if (reduced.matches) {
        stop();
        ctx.clearRect(0, 0, width, height);
      } else {
        start();
      }
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    reduced.addEventListener("change", onMotionChange);
    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      reduced.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="wn-snow" aria-hidden="true" />;
}
