"use client";

import { useEffect, useRef } from "react";

/**
 * The saved constellation background (design-library/constellation-background.html
 * in LeadLab-RevOPs), ported to React: nodes twinkle and drift upward, nearby
 * nodes link with faint lines, and the cursor pulls lines toward itself over a
 * slowly breathing brand glow. Same maths as the original; the page-builder
 * placement code it needed for ClickFunnels isn't needed here.
 */
export function Constellation({
  color = "#b2b1ff",
  color2 = "#ece9ff",
  density = 1,
}: {
  color?: string;
  color2?: string;
  density?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgb = hexRgb(color) ?? [178, 177, 255];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const LINK = 120;
    const PULL = 170;
    const c1 = hexRgb(color) ?? [178, 177, 255];
    const c2 = hexRgb(color2) ?? [236, 233, 255];
    const main = `rgb(${c1})`;
    const second = `rgb(${c2})`;
    const line = `rgba(${c1},`;

    type Node = { x: number; y: number; z: number; r: number; a: number; vx: number; vy: number; tw: number; ph: number; g: boolean };
    const newNode = (): Node => {
      const z = Math.random();
      return {
        x: Math.random(),
        y: Math.random(),
        z,
        r: 0.6 + z * 1.8,
        a: 0.25 + Math.random() * 0.55,
        vx: (Math.random() - 0.5) * 0.004,
        vy: -(0.004 + Math.random() * 0.01),
        tw: 0.5 + Math.random() * 1.8,
        ph: Math.random() * 6.283,
        g: Math.random() < 0.55,
      };
    };

    let W = 0;
    let H = 0;
    let raf = 0;
    let clock = 0;
    let last = 0;
    const nodes: Node[] = [];
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(150, Math.max(46, (W * H) / 11000)) * density);
      while (nodes.length < target) nodes.push(newNode());
      nodes.length = target;
      if (reduce) draw();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const sec = clock / 1000;
      const pts: number[] = [];
      for (const n of nodes) {
        let x = (n.x + n.vx * sec) * W;
        let y = (n.y + n.vy * sec) * H;
        x = ((x % W) + W) % W;
        y = ((y % H) + H) % H;
        pts.push(x, y);
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const xi = pts[i * 2];
        const yi = pts[i * 2 + 1];
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = xi - pts[j * 2];
          const dy = yi - pts[j * 2 + 1];
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            ctx.strokeStyle = `${line}${(0.14 * (1 - Math.sqrt(d2) / LINK)).toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(xi, yi);
            ctx.lineTo(pts[j * 2], pts[j * 2 + 1]);
            ctx.stroke();
          }
        }
        const md = Math.hypot(xi - mouse.x, yi - mouse.y);
        if (md < PULL) {
          ctx.strokeStyle = `${line}${(0.32 * (1 - md / PULL)).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(xi, yi);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      nodes.forEach((n, i) => {
        const tw = 0.6 + 0.4 * Math.sin(sec * n.tw + n.ph);
        ctx.globalAlpha = n.a * tw;
        ctx.fillStyle = n.g ? main : second;
        ctx.beginPath();
        ctx.arc(pts[i * 2], pts[i * 2 + 1], n.r, 0, 6.283);
        ctx.fill();
        if (n.g && n.r > 1.8) {
          ctx.globalAlpha = n.a * tw * 0.18;
          ctx.beginPath();
          ctx.arc(pts[i * 2], pts[i * 2 + 1], n.r * 4, 0, 6.283);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      clock += last ? Math.min(50, now - last) : 16;
      last = now;
      if (Math.abs(canvas.clientHeight - H) > 2 || Math.abs(canvas.clientWidth - W) > 2) resize();
      draw();
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };

    resize();
    window.addEventListener("resize", resize);
    if (!reduce) {
      raf = requestAnimationFrame(frame);
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [color, color2, density]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div
        className="constellation-glow absolute inset-0"
        style={{
          background: `radial-gradient(42% 36% at 78% 8%, rgba(${rgb},.16), transparent 70%), radial-gradient(36% 30% at 8% 30%, rgba(${rgb},.07), transparent 70%), radial-gradient(50% 40% at 50% 110%, rgba(${rgb},.10), transparent 70%)`,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
    </div>
  );
}

function hexRgb(hex: string) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, "$&$&") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
