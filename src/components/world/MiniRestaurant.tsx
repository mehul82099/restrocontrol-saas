'use client';

import React, { useEffect, useRef } from 'react';

// Isometric helpers. 1 grid unit = 64px wide diamond (32 / 16 half sizes).
const OX = 400;
const OY = 160;
const WALL_H = 130;
const N = 9;

const P = (x: number, y: number, z = 0): [number, number] => [OX + (x - y) * 32, OY + (x + y) * 16 - z];
const pts = (arr: [number, number][]) => arr.map((p) => p.join(',')).join(' ');

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

type Item = { depth: number; node: React.ReactNode };

function box(key: string, x: number, y: number, w: number, d: number, h: number, color: string, z0 = 0, topColor?: string): Item {
  const top = pts([P(x, y, z0 + h), P(x + w, y, z0 + h), P(x + w, y + d, z0 + h), P(x, y + d, z0 + h)]);
  const left = pts([P(x, y + d, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + h), P(x, y + d, z0 + h)]);
  const right = pts([P(x + w, y, z0), P(x + w, y + d, z0), P(x + w, y + d, z0 + h), P(x + w, y, z0 + h)]);
  return {
    depth: x + w / 2 + y + d / 2 + z0 / 200,
    node: (
      <g key={key}>
        <polygon points={left} fill={shade(color, 0.72)} />
        <polygon points={right} fill={shade(color, 0.5)} />
        <polygon points={top} fill={topColor || color} />
      </g>
    ),
  };
}

function cyl(key: string, cx: number, cy: number, r: number, h: number, color: string, z0 = 0): Item {
  const [tx, ty] = P(cx, cy, z0 + h);
  const [bx, by] = P(cx, cy, z0);
  const rx = r * 45;
  const ry = r * 22.6;
  return {
    depth: cx + cy + z0 / 200,
    node: (
      <g key={key}>
        <ellipse cx={bx} cy={by + 1} rx={rx} ry={ry} fill="rgba(0,0,0,.35)" />
        <path d={`M${bx - rx},${by} L${tx - rx},${ty} L${tx + rx},${ty} L${bx + rx},${by} Z`} fill={shade(color, 0.6)} />
        <ellipse cx={bx} cy={by} rx={rx} ry={ry} fill={shade(color, 0.6)} />
        <ellipse cx={tx} cy={ty} rx={rx} ry={ry} fill={color} />
      </g>
    ),
  };
}

function Person({ x, y, color, hat, dur = 1.6, delay = 0 }: { x: number; y: number; color: string; hat?: boolean; dur?: number; delay?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cx="0" cy="0" rx="8" ry="3.5" fill="rgba(0,0,0,.4)" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0;0,-1.6;0,0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
        <rect x="-5" y="-17" width="10" height="15" rx="4" fill={color} />
        <circle cx="0" cy="-23" r="5" fill="#f2c9a0" />
        {hat ? <rect x="-5" y="-33" width="10" height="7" rx="2.5" fill="#f5f5f4" /> : <path d="M-5,-24 a5,5 0 0 1 10,0 z" fill="#2b1d14" />}
      </g>
    </g>
  );
}

function Walker({ path, dur, color, delay = 0, begin = 0 }: { path: [number, number][]; dur: number; color: string; delay?: number; begin?: number }) {
  const vals = path.map(([x, y]) => P(x, y, 0).join(',')).join(';');
  return (
    <g>
      <animateTransform attributeName="transform" type="translate" values={vals} dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" calcMode="linear" />
      <ellipse cx="0" cy="0" rx="8" ry="3.5" fill="rgba(0,0,0,.4)" />
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0;0,-2.2;0,0" dur="0.5s" begin={`${delay}s`} repeatCount="indefinite" />
        <rect x="-5" y="-17" width="10" height="15" rx="4" fill={color} />
        <circle cx="0" cy="-23" r="5" fill="#f2c9a0" />
        <path d="M-5,-24 a5,5 0 0 1 10,0 z" fill="#2b1d14" />
        <rect x="-9" y="-16" width="9" height="2.6" rx="1" fill="#e7e5e4" />
        <circle cx="-9" cy="-17" r="2.4" fill="#fbbf24" />
      </g>
    </g>
  );
}

function Steam({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <circle cx={x} cy={y} r="3.5" fill="#fff" opacity="0">
      <animate attributeName="cy" values={`${y};${y - 34}`} dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="r" values="2.5;7" dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;.35;0" dur="3s" begin={`${delay}s`} repeatCount="indefinite" />
    </circle>
  );
}

function Lamp({ cx, cy, z = 112, delay = 0 }: { cx: number; cy: number; z?: number; delay?: number }) {
  const [x, y] = P(cx, cy, z);
  const [fx, fy] = P(cx, cy, 0);
  return (
    <g>
      <ellipse cx={fx} cy={fy} rx="62" ry="31" fill="url(#glow)">
        <animate attributeName="opacity" values="1;.82;1;.92;1" dur="5s" begin={`${delay}s`} repeatCount="indefinite" />
      </ellipse>
      <line x1={x} y1={y - 38} x2={x} y2={y} stroke="#0b0f14" strokeWidth="1" />
      <path d={`M${x - 11},${y + 9} Q${x},${y - 7} ${x + 11},${y + 9} Z`} fill="#f59e0b" />
      <ellipse cx={x} cy={y + 9} rx="11" ry="3" fill="#fde68a" />
    </g>
  );
}

export default function MiniRestaurant({ className = '', slice = false, paused = false }: { className?: string; slice?: boolean; paused?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || paused) ref.current?.pauseAnimations?.();
    else ref.current?.unpauseAnimations?.();
  }, [paused]);

  // floor
  const tiles: React.ReactNode[] = [];
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      tiles.push(
        <polygon key={`t${i}-${j}`} points={pts([P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)])} fill={(i + j) % 2 ? '#3b2d21' : '#32261c'} />,
      );

  const items: Item[] = [];
  // kitchen
  items.push(box('fridge', 4.0, 0.15, 0.8, 1.0, 62, '#9fb4c7'));
  items.push(box('stove1', 5.0, 0.2, 1.2, 1.2, 30, '#5b6573', 0, '#3b434e'));
  items.push(box('stove2', 6.4, 0.2, 1.2, 1.2, 30, '#5b6573', 0, '#3b434e'));
  items.push(box('stove3', 7.8, 0.2, 1.1, 1.2, 30, '#5b6573', 0, '#3b434e'));
  items.push(box('hood', 5.0, 0.0, 4.0, 1.4, 12, '#7b8796', 80));
  items.push(box('pass', 4.6, 2.3, 4.4, 0.7, 34, '#8a5a34', 0, '#a8723f'));
  // plates on the pass
  [5.4, 6.4, 7.4, 8.3].forEach((px, i) => items.push(box(`plate${i}`, px, 2.5, 0.35, 0.35, 3, i % 2 ? '#fde68a' : '#fb923c', 34)));
  // cashier
  items.push(box('cash', 0.15, 1.2, 0.9, 2.6, 34, '#7a4e2c', 0, '#9b6a3b'));
  items.push(box('pos', 0.35, 2.3, 0.5, 0.9, 14, '#1f2937', 34, '#10b981'));
  items.push(box('printer', 0.35, 1.45, 0.5, 0.5, 8, '#cbd5e1', 34));

  // tables + chairs
  const tables: [number, number][] = [
    [2.6, 5.6],
    [5.3, 6.9],
    [7.5, 5.3],
    [2.6, 7.9],
  ];
  tables.forEach(([cx, cy], i) => {
    items.push(cyl(`tbl${i}`, cx, cy, 0.55, 26, '#c08457'));
    items.push(box(`chL${i}`, cx - 1.25, cy - 0.25, 0.5, 0.5, 16, '#6b3f26'));
    items.push(box(`chR${i}`, cx + 0.75, cy - 0.25, 0.5, 0.5, 16, '#6b3f26'));
    const [px, py] = P(cx, cy, 28);
    items.push({
      depth: cx + cy + 0.1,
      node: (
        <g key={`pl${i}`}>
          <ellipse cx={px - 8} cy={py} rx="8" ry="4" fill="#f5f5f4" />
          <ellipse cx={px + 9} cy={py + 1} rx="8" ry="4" fill="#f5f5f4" />
          <circle cx={px} cy={py - 4} r="2.4" fill="#fbbf24">
            <animate attributeName="opacity" values="1;.55;1;.8;1" dur={`${1.4 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
        </g>
      ),
    });
  });
  // plant
  const [plx, ply] = P(8.4, 8.2, 0);
  items.push({
    depth: 16.6,
    node: (
      <g key="plant">
        <rect x={plx - 8} y={ply - 12} width="16" height="12" rx="3" fill="#7c2d12" />
        <circle cx={plx} cy={ply - 22} r="10" fill="#15803d" />
        <circle cx={plx - 8} cy={ply - 17} r="7" fill="#166534" />
        <circle cx={plx + 8} cy={ply - 18} r="7" fill="#16a34a" />
      </g>
    ),
  });
  items.sort((a, b) => a.depth - b.depth);

  // walls
  const rightWall = pts([P(0, 0, 0), P(N, 0, 0), P(N, 0, WALL_H), P(0, 0, WALL_H)]);
  const leftWall = pts([P(0, 0, 0), P(0, N, 0), P(0, N, WALL_H), P(0, 0, WALL_H)]);
  const [rx0, ry0] = P(0, 0, 0);

  const [ex, ey] = P(0, 0, 0);
  void ex; void ey;
  // slab thickness (front edges)
  const slabL = pts([P(0, N, 0), P(N, N, 0), P(N, N, -14), P(0, N, -14)]);
  const slabR = pts([P(N, 0, 0), P(N, N, 0), P(N, N, -14), P(N, 0, -14)]);

  const ticket = P(0.6, 1.7, 42);
  const posScreen = P(0.6, 2.75, 52);

  return (
    <svg
      ref={ref}
      className={className}
      viewBox="90 20 620 450"
      preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'}
      role="img"
      aria-label="Animated miniature restaurant: chefs cook, waiters carry plates, orders print at the counter"
    >
      <defs>
        <radialGradient id="glow">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity=".55" />
          <stop offset="60%" stopColor="#f59e0b" stopOpacity=".14" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wallR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#101a27" />
          <stop offset="1" stopColor="#1b2a3b" />
        </linearGradient>
        <linearGradient id="wallL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0c1420" />
          <stop offset="1" stopColor="#16222f" />
        </linearGradient>
        <filter id="neon" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <polygon points={slabL} fill="#1a120b" />
      <polygon points={slabR} fill="#120c07" />
      <polygon points={rightWall} fill="url(#wallR)" />
      <polygon points={leftWall} fill="url(#wallL)" />
      {tiles}

      {/* neon sign on the back (kitchen) wall */}
      <g transform={`matrix(1 .5 0 1 ${P(3.3, 0, 0)[0]} ${P(3.3, 0, 0)[1] - 118})`}>
        <text x="0" y="0" fontSize="17" fontWeight="900" fill="#34d399" filter="url(#neon)" fontFamily="Arial, sans-serif" letterSpacing="1.5">
          RESTROCONTROL
          <animate attributeName="opacity" values="1;1;.7;1;1;.85;1" dur="6s" repeatCount="indefinite" />
        </text>
      </g>
      {/* windows + menu board on left wall */}
      {[1.2, 4.4].map((yy, i) => (
        <g key={`w${i}`} transform={`matrix(1 -.5 0 1 ${P(0, yy + 2, 0)[0]} ${P(0, yy + 2, 0)[1] - 100})`}>
          <rect x="0" y="0" width="64" height="62" rx="2" fill="#1e3a5f" stroke="#0b0f14" strokeWidth="3" />
          <rect x="3" y="3" width="26" height="56" fill="#f59e0b" opacity=".16" />
          <rect x="35" y="3" width="26" height="56" fill="#f59e0b" opacity=".1" />
          <circle cx="46" cy="14" r="1.5" fill="#fff" opacity=".8"><animate attributeName="opacity" values=".2;1;.2" dur={`${2 + i}s`} repeatCount="indefinite" /></circle>
          <circle cx="14" cy="22" r="1.2" fill="#fff" opacity=".8"><animate attributeName="opacity" values="1;.2;1" dur={`${3 + i}s`} repeatCount="indefinite" /></circle>
        </g>
      ))}
      <g transform={`matrix(1 -.5 0 1 ${P(0, 8.2, 0)[0]} ${P(0, 8.2, 0)[1] - 98})`}>
        <rect x="0" y="0" width="60" height="50" rx="2" fill="#1c2b22" stroke="#7c4a24" strokeWidth="3" />
        <text x="30" y="17" fontSize="8" fill="#d6d3d1" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700">TODAY</text>
        <rect x="9" y="24" width="42" height="2" fill="#a8a29e" opacity=".7" />
        <rect x="9" y="31" width="34" height="2" fill="#a8a29e" opacity=".7" />
        <rect x="9" y="38" width="40" height="2" fill="#a8a29e" opacity=".7" />
      </g>
      {/* string lights */}
      {Array.from({ length: 12 }).map((_, i) => {
        const [lx, ly] = P(0.4 + i * 0.7, 0, WALL_H - 10 - Math.sin(i * 1.1) * 4);
        return (
          <circle key={`s${i}`} cx={lx} cy={ly} r="2.2" fill="#fcd34d">
            <animate attributeName="opacity" values="1;.25;1" dur={`${2 + (i % 4) * 0.6}s`} begin={`${(i % 5) * 0.4}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {items.map((it) => it.node)}

      {/* POS screen content + printer ticket */}
      <g>
        <rect x={posScreen[0] - 6} y={posScreen[1] - 4} width="12" height="3" fill="#064e3b" opacity=".8" />
        <rect x={ticket[0] - 3} y={ticket[1]} width="7" height="0" fill="#fafaf9">
          <animate attributeName="height" values="0;0;16;16;0" keyTimes="0;.1;.35;.9;1" dur="6s" repeatCount="indefinite" />
          <animate attributeName="y" values={`${ticket[1]};${ticket[1]};${ticket[1] - 16};${ticket[1] - 16};${ticket[1] - 16}`} keyTimes="0;.1;.35;.9;1" dur="6s" repeatCount="indefinite" />
        </rect>
      </g>

      {/* steam from stoves */}
      {[5.6, 7.0, 8.3].map((sx, i) => {
        const [x, y] = P(sx, 0.8, 34);
        return (
          <g key={`st${i}`}>
            <Steam x={x} y={y} delay={i * 0.9} />
            <Steam x={x + 5} y={y + 2} delay={i * 0.9 + 1.5} />
          </g>
        );
      })}

      {/* lamps */}
      {tables.map(([cx, cy], i) => (
        <Lamp key={`lamp${i}`} cx={cx} cy={cy} delay={i * 0.7} />
      ))}
      <Lamp cx={6.7} cy={1.6} z={74} delay={0.3} />
      <Lamp cx={1.6} cy={2.5} z={100} delay={1.1} />

      {/* people */}
      {(() => { const [a, b] = P(5.7, 1.7); return <g key="c1"><Person x={a} y={b} color="#f8fafc" hat delay={0} /></g>; })()}
      {(() => { const [a, b] = P(7.3, 1.7); return <g key="c2"><Person x={a} y={b} color="#f8fafc" hat delay={0.5} dur={1.3} /></g>; })()}
      {(() => { const [a, b] = P(1.7, 2.7); return <g key="c3"><Person x={a} y={b} color="#0ea5e9" delay={0.2} /></g>; })()}
      {tables.map(([cx, cy], i) => {
        const [a, b] = P(cx - 1.0, cy, 0);
        const [c, d] = P(cx + 1.0, cy, 0);
        return (
          <g key={`g${i}`}>
            <Person x={a} y={b - 6} color={['#e11d48', '#7c3aed', '#ea580c', '#0d9488'][i]} delay={i * 0.3} dur={2 + i * 0.2} />
            <Person x={c} y={d - 6} color={['#2563eb', '#ca8a04', '#db2777', '#65a30d'][i]} delay={i * 0.4} dur={2.2 + i * 0.1} />
          </g>
        );
      })}
      <Walker color="#059669" dur={14} path={[[7.0, 3.5], [7.0, 3.5], [7.4, 4.5], [7.4, 4.5], [7.0, 3.5], [5.5, 3.5], [5.4, 5.9], [5.4, 5.9], [5.5, 3.5], [7.0, 3.5]]} />
      <Walker color="#d97706" dur={16} begin={-7} delay={0.2} path={[[5.0, 3.5], [3.0, 4.2], [2.9, 4.5], [2.9, 4.5], [3.2, 6.6], [2.9, 7.0], [2.9, 7.0], [3.3, 4.2], [5.0, 3.5], [5.0, 3.5]]} />
    </svg>
  );
}
