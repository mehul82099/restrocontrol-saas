'use client';

import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

export type StopId = 'overview' | 'booth' | 'counter' | 'kitchen' | 'street';

export const STOPS: Record<StopId, { pos: [number, number, number]; target: [number, number, number]; fov: number }> = {
  overview: { pos: [12, 9.5, 15.5], target: [0, 0, 1.8], fov: 36 },
  booth: { pos: [-4.9, 1.9, 4.6], target: [1.2, 0.7, -0.5], fov: 55 },
  counter: { pos: [-0.5, 2.1, 3.6], target: [-5.2, 0.8, -0.8], fov: 55 },
  kitchen: { pos: [-0.5, 2.8, 2.6], target: [3.9, 1.0, -3.3], fov: 52 },
  street: { pos: [0.5, 1.8, 13.5], target: [0, 1.2, 3.5], fov: 48 },
};

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const SPH = new THREE.SphereGeometry(1, 12, 10);

type V3 = [number, number, number];
function B({ p, s, c, e, ei = 1, r }: { p: V3; s: V3; c: string; e?: string; ei?: number; r?: number }) {
  return (
    <mesh geometry={BOX} position={p} scale={s} rotation={[0, r || 0, 0]}>
      <meshLambertMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? ei : 0} />
    </mesh>
  );
}
function C({ p, r, h, c, e }: { p: V3; r: number; h: number; c: string; e?: string }) {
  return (
    <mesh geometry={CYL} position={p} scale={[r, h, r]}>
      <meshLambertMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? 1 : 0} />
    </mesh>
  );
}
function S({ p, r, c, e }: { p: V3; r: number; c: string; e?: string }) {
  return (
    <mesh geometry={SPH} position={p} scale={r}>
      <meshLambertMaterial color={c} emissive={e || '#000'} emissiveIntensity={e ? 1 : 0} />
    </mesh>
  );
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.anisotropy = 4;
  return t;
}

function Person({ color, seated = false, hat = false, refCb }: { color: string; seated?: boolean; hat?: boolean; refCb?: (g: THREE.Group | null) => void }) {
  const y = seated ? 0.62 : 0.5;
  return (
    <group ref={refCb}>
      <C p={[0, y, 0]} r={0.17} h={seated ? 0.4 : 0.55} c={color} />
      <S p={[0, y + (seated ? 0.4 : 0.52), 0]} r={0.14} c="#f2c9a0" />
      {hat ? <C p={[0, y + (seated ? 0.58 : 0.7), 0]} r={0.12} h={0.16} c="#f5f5f4" /> : <S p={[0, y + (seated ? 0.45 : 0.57), -0.02]} r={0.135} c="#2b1d14" />}
    </group>
  );
}

function pathPoint(pts: V3[], dist: number): { x: number; z: number; ang: number } {
  // ping-pong along a polyline
  const seg: number[] = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]); seg.push(d); L += d; }
  let d = dist % (2 * L);
  const back = d > L;
  if (back) d = 2 * L - d;
  let i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const f = Math.min(1, d / seg[i]);
  const a = pts[i], b = pts[i + 1];
  const dx = (b[0] - a[0]) * (back ? -1 : 1), dz = (b[2] - a[2]) * (back ? -1 : 1);
  return { x: a[0] + (b[0] - a[0]) * f, z: a[2] + (b[2] - a[2]) * f, ang: Math.atan2(dx, dz) };
}

function Walker({ path, speed, color, offset = 0, motion }: { path: V3[]; speed: number; color: string; offset?: number; motion: boolean }) {
  const g = useRef<THREE.Group | null>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = motion ? clock.elapsedTime : 0;
    const p = pathPoint(path, t * speed + offset);
    g.current.position.set(p.x, Math.abs(Math.sin(t * 7)) * 0.04, p.z);
    g.current.rotation.y = p.ang;
  });
  return (
    <group ref={g}>
      <Person color={color} />
      <B p={[0.0, 0.62, 0.22]} s={[0.3, 0.03, 0.22]} c="#e7e5e4" />
      <S p={[0, 0.68, 0.22]} r={0.07} c="#fbbf24" />
    </group>
  );
}

function Bob({ children, p, rot = 0, phase = 0, motion }: { children: React.ReactNode; p: V3; rot?: number; phase?: number; motion: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current && motion) g.current.position.y = p[1] + Math.sin(clock.elapsedTime * 2 + phase) * 0.015; });
  return <group ref={g} position={p} rotation={[0, rot, 0]}>{children}</group>;
}

function Steam({ at, motion }: { at: V3; motion: boolean }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    refs.current.forEach((m, i) => {
      if (!m) return;
      const t = motion ? ((clock.elapsedTime * 0.5 + i / 3) % 1) : i / 3;
      m.position.set(at[0] + Math.sin(t * 6 + i) * 0.06, at[1] + t * 1.1, at[2]);
      m.scale.setScalar(0.07 + t * 0.2);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * Math.PI) * 0.35;
    });
  });
  return (
    <>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={SPH} ref={(m) => { refs.current[i] = m; }}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function Lamp({ p, flick = 0 }: { p: V3; flick?: number }) {
  return (
    <group position={p}>
      <C p={[0, 0.9, 0]} r={0.012} h={1.8} c="#6b7280" />
      <mesh geometry={CYL} position={[0, 0, 0]} scale={[0.35, 0.22, 0.35]}>
        <cylinderGeometry args={[0.4, 1, 1, 14]} />
        <meshLambertMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.6 + 0} />
      </mesh>
      <S p={[0, -0.14, 0]} r={0.12} c="#fff3c4" e="#ffe08a" />
    </group>
  );
}

function Booth({ x, z, flip, motion, i }: { x: number; z: number; flip?: boolean; motion: boolean; i: number }) {
  const leather = '#12a574';
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 0.72, 0]} s={[1.3, 0.06, 0.8]} c="#fffaf0" />
      <B p={[0, 0.36, 0]} s={[0.12, 0.72, 0.12]} c="#a8a29e" />
      <B p={[0, 0.2, -0.85]} s={[1.4, 0.4, 0.5]} c={leather} />
      <B p={[0, 0.65, -1.05]} s={[1.4, 0.8, 0.12]} c={shadeHex(leather, 0.85)} />
      <B p={[0, 0.2, 0.85]} s={[1.4, 0.4, 0.5]} c={leather} />
      <B p={[0, 0.65, 1.05]} s={[1.4, 0.8, 0.12]} c={shadeHex(leather, 0.85)} />
      <S p={[-0.25, 0.8, 0]} r={0.12} c="#f5f5f4" />
      <S p={[0.3, 0.8, 0.05]} r={0.12} c="#f5f5f4" />
      <S p={[0, 0.84, 0]} r={0.04} c="#fbbf24" e="#fbbf24" />
      <Bob p={[-0.2, 0.0, -0.8]} rot={0} phase={i} motion={motion}><Person color={['#e11d48', '#7c3aed', '#ea580c'][i % 3]} seated /></Bob>
      <Bob p={[0.25, 0.0, 0.8]} rot={Math.PI} phase={i + 2} motion={motion}><Person color={['#2563eb', '#ca8a04', '#0d9488'][i % 3]} seated /></Bob>
      <Lamp p={[0, 3.0, 0]} />
    </group>
  );
}
function shadeHex(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

function Car({ z, speed, color, off, motion }: { z: number; speed: number; color: string; off: number; motion: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = motion ? clock.elapsedTime : 0;
    const x = ((t * speed + off) % 26) - 13;
    g.current.position.x = speed > 0 ? x : -x;
  });
  return (
    <group ref={g} position={[0, 0, z]} rotation={[0, speed > 0 ? 0 : Math.PI, 0]}>
      <B p={[0, 0.3, 0]} s={[1.5, 0.35, 0.7]} c={color} />
      <B p={[-0.1, 0.58, 0]} s={[0.8, 0.28, 0.62]} c="#1f2937" />
      <B p={[0.76, 0.32, 0.2]} s={[0.05, 0.1, 0.14]} c="#fde68a" e="#fde68a" />
      <B p={[0.76, 0.32, -0.2]} s={[0.05, 0.1, 0.14]} c="#fde68a" e="#fde68a" />
      <B p={[-0.76, 0.32, 0.2]} s={[0.04, 0.08, 0.12]} c="#ef4444" e="#ef4444" />
      <B p={[-0.76, 0.32, -0.2]} s={[0.04, 0.08, 0.12]} c="#ef4444" e="#ef4444" />
    </group>
  );
}

function Rig({ stop, reduced }: { stop: StopId; reduced: boolean }) {
  const { camera, size } = useThree();
  const tgt = useRef(new THREE.Vector3(...STOPS.overview.target));
  const first = useRef(true);
  useFrame(({ clock }, dt) => {
    const s = STOPS[stop];
    const k = reduced || first.current ? 1 : 1 - Math.exp(-dt * 2.6);
    first.current = false;
    const t = clock.elapsedTime;
    const sway = reduced ? 0 : 1;
    const wantPos = new THREE.Vector3(s.pos[0] + Math.sin(t * 0.25) * 0.12 * sway, s.pos[1] + Math.sin(t * 0.31) * 0.05 * sway, s.pos[2]);
    camera.position.lerp(wantPos, k);
    tgt.current.lerp(new THREE.Vector3(...s.target), k);
    camera.lookAt(tgt.current);
    const cam = camera as THREE.PerspectiveCamera;
    // portrait screens need a wider field of view to keep the scene in frame
    const aspectBoost = size.width / size.height < 0.8 ? 1.35 : 1;
    cam.fov += (s.fov * aspectBoost - cam.fov) * k;
    // on wide screens push the scene to the right so the content card does not cover it
    if (size.width > 900) cam.setViewOffset(size.width, size.height, -size.width * 0.13, 0, size.width, size.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  });
  return null;
}

function World({ motion }: { motion: boolean }) {
  const tex = useMemo(() => {
    const floor = canvasTex(128, 128, (g) => { g.fillStyle = '#efe6d4'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e2d6bd'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64); }, [8, 5.5]);
    floor.magFilter = THREE.NearestFilter;
    const awning = canvasTex(128, 32, (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#10b981' : '#fffaf0'; g.fillRect(i * 16, 0, 16, 32); } }, [3, 1]);
    const sign = canvasTex(512, 96, (g) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 96); g.strokeStyle = '#10b981'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 90); g.font = '900 56px Arial'; g.fillStyle = '#047857'; g.textAlign = 'center'; g.fillText('RESTROCONTROL', 256, 68); });
    const board = canvasTex(256, 192, (g) => { g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 256, 192); g.strokeStyle = '#10b981'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 182); g.fillStyle = '#1f2937'; g.font = '700 26px Arial'; g.textAlign = 'center'; g.fillText("TODAY'S SPECIAL", 128, 50); g.fillStyle = '#9ca3af'; for (let i = 0; i < 4; i++) g.fillRect(40, 80 + i * 26, 120 + ((i * 37) % 60), 6); });
    const city = canvasTex(128, 256, (g) => { g.fillStyle = '#e9e2d3'; g.fillRect(0, 0, 128, 256); for (let y = 12; y < 250; y += 22) for (let x = 10; x < 120; x += 20) { if ((x * 7 + y * 13) % 5 < 2) { g.fillStyle = (x + y) % 3 ? '#fcd9a0' : '#bfe3f5'; g.globalAlpha = 1; g.fillRect(x, y, 9, 11); g.globalAlpha = 1; } } });
    return { floor, awning, sign, board, city };
  }, []);

  const aisleWaiter: V3[] = [[3.4, 0, -1.4], [3.4, 0, 1.85], [-3.4, 0, 1.85]];
  const counterWaiter: V3[] = [[-3.8, 0, -3.0], [-3.8, 0, 1.6], [-1.5, 0, 1.85]];
  const buildings = [[-11, 5, 3.5], [-7, 7.5, 3], [-3, 4.5, 3.2], [2, 8.5, 3.6], [6.5, 5.5, 3], [11, 7, 3.4]];

  return (
    <>
      <fog attach="fog" args={['#f3ede0', 28, 60]} />
      <color attach="background" args={['#f3ede0']} />
      <ambientLight intensity={1.15} color="#fff6e8" />
      <hemisphereLight args={['#ffffff', '#d9c9a8', 0.6]} />
      <directionalLight position={[6, 10, 8]} intensity={1.3} color="#fff1d6" />
      
      

      {/* diorama slab */}
      <B p={[0, -0.25, 2.6]} s={[14.4, 0.5, 14.2]} c="#fbf8f1" />
      <mesh position={[0, 0.001, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 9]} />
        <meshLambertMaterial map={tex.floor} />
      </mesh>
      {/* walls */}
      <B p={[0, 1.6, -4.2]} s={[12.2, 3.2, 0.2]} c="#f7f3ea" />
      <B p={[-6.1, 1.6, 0.2]} s={[0.2, 3.2, 8.8]} c="#efe9dc" />
      <B p={[6.1, 0.55, 0.2]} s={[0.2, 1.1, 8.8]} c="#efe9dc" />
      {/* awnings along the back wall */}
      {[-3.6, 0.2, 4.0].map((x, i) => (
        <mesh key={i} position={[x, 2.55, -3.7]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[2.8, 0.05, 1.1]} />
          <meshLambertMaterial map={tex.awning} />
        </mesh>
      ))}
      {/* neon sign + board */}
      <mesh position={[3.9, 2.95, -4.08]}>
        <planeGeometry args={[3.6, 0.68]} />
        <meshBasicMaterial map={tex.sign} toneMapped={false} />
      </mesh>
      <mesh position={[-6.0, 1.8, 2.4]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.5, 1.1]} />
        <meshLambertMaterial map={tex.board} />
      </mesh>
      {/* windows on left wall */}
      {[-1.6, 0.6].map((z, i) => (
        <mesh key={i} position={[-5.99, 1.9, z]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.2, 1.1]} />
          <meshBasicMaterial color="#cfe9f7" />
        </mesh>
      ))}

      {/* counter + stools */}
      <B p={[-5.1, 0.55, -0.4]} s={[1.0, 1.1, 4.6]} c="#10b981" />
      <B p={[-5.1, 1.12, -0.4]} s={[1.15, 0.08, 4.8]} c="#f5ede0" />
      {[-2.2, -1.2, -0.2, 0.8].map((z, i) => (
        <group key={i}>
          <C p={[-4.15, 0.34, z]} r={0.2} h={0.05} c="#34d399" />
          <C p={[-4.15, 0.17, z]} r={0.04} h={0.34} c="#52525b" />
        </group>
      ))}
      <B p={[-5.1, 1.34, 1.3]} s={[0.45, 0.35, 0.5]} c="#334155" />
      <B p={[-4.88, 1.4, 1.3]} s={[0.04, 0.24, 0.4]} c="#10b981" e="#10b981" ei={0.9} />
      <B p={[-5.2, 1.28, -1.3]} s={[0.5, 0.25, 0.4]} c="#cbd5e1" />
      <Bob p={[-5.75, 0, 0.3]} rot={Math.PI / 2} motion={motion}><Person color="#0ea5e9" /></Bob>
      {/* shelves with bottles */}
      {[1.4, 1.9, 2.4].map((y, i) => (
        <group key={i}>
          <B p={[-5.95, y, -2.1]} s={[0.25, 0.04, 2.6]} c="#6b4a2e" />
          {Array.from({ length: 7 }).map((_, j) => <B key={j} p={[-5.95, y + 0.14, -3.2 + j * 0.34]} s={[0.12, 0.24, 0.12]} c={['#1e3a5f', '#7c2d12', '#14532d', '#78350f'][(i + j) % 4]} />)}
        </group>
      ))}

      {/* kitchen */}
      <B p={[0.8, 0.9, -3.4]} s={[0.9, 1.8, 0.9]} c="#dbe7ef" />
      {[2.4, 3.9, 5.2].map((x, i) => (
        <group key={i}>
          <B p={[x, 0.45, -3.5]} s={[1.2, 0.9, 1.0]} c="#9aa5b1" />
          <B p={[x, 0.93, -3.5]} s={[1.2, 0.05, 1.0]} c="#4b5563" />
          <C p={[x - 0.25, 0.97, -3.5]} r={0.16} h={0.03} c="#f97316" e="#f97316" />
          <C p={[x + 0.25, 0.97, -3.5]} r={0.16} h={0.03} c="#ef4444" e="#ef4444" />
          <Steam at={[x, 1.1, -3.5]} motion={motion} />
        </group>
      ))}
      <B p={[3.8, 2.7, -3.55]} s={[4.0, 0.35, 1.1]} c="#c9d2dc" />
      <B p={[3.8, 0.55, -2.1]} s={[4.6, 1.1, 0.7]} c="#e9d5b5" />
      <B p={[3.8, 1.12, -2.1]} s={[4.7, 0.06, 0.8]} c="#fffaf0" />
      {[2.0, 3.1, 4.2, 5.2].map((x, i) => <C key={i} p={[x, 1.19, -2.1]} r={0.16} h={0.05} c={i % 2 ? '#fde68a' : '#fb923c'} />)}
      <Bob p={[2.7, 0, -2.9]} motion={motion}><Person color="#f8fafc" hat /></Bob>
      <Bob p={[4.9, 0, -2.9]} phase={1} motion={motion}><Person color="#f8fafc" hat /></Bob>
      <Lamp p={[3.8, 3.3, -1.6]} />

      {/* booths */}
      {[-2.4, 0.2, 2.8].map((x, i) => <Booth key={`a${i}`} x={x} z={0.3} motion={motion} i={i} />)}
      {[-2.4, 0.2, 2.8].map((x, i) => <Booth key={`b${i}`} x={x} z={3.4} motion={motion} i={i + 1} />)}
      <Walker path={aisleWaiter} speed={0.9} color="#059669" motion={motion} />
      <Walker path={counterWaiter} speed={0.8} color="#d97706" offset={3} motion={motion} />

      {/* plants */}
      {[[-3.6, -3.4], [5.4, 4.0], [-5.4, 4.0]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <C p={[0, 0.2, 0]} r={0.22} h={0.4} c="#7c2d12" />
          <S p={[0, 0.65, 0]} r={0.32} c="#15803d" />
          <S p={[0.15, 0.85, 0.05]} r={0.22} c="#16a34a" />
        </group>
      ))}

      {/* street */}
      <B p={[0, 0.02, 5.8]} s={[13.5, 0.06, 1.4]} c="#e8dfcc" />
      <B p={[0, 0.02, 8.7]} s={[13.5, 0.05, 3.8]} c="#a7acb4" />
      {Array.from({ length: 10 }).map((_, i) => <B key={i} p={[-6 + i * 1.35, 0.06, 8.7]} s={[0.7, 0.01, 0.1]} c="#fbbf24" />)}
      <B p={[0, 0.02, 11.4]} s={[13.5, 0.06, 1.2]} c="#e8dfcc" />
      <Car z={8.1} speed={1.6} color="#e11d48" off={2} motion={motion} />
      <Car z={9.3} speed={-1.2} color="#2563eb" off={9} motion={motion} />
      {[-4.5, 4.8].map((x, i) => (
        <group key={i} position={[x, 0, 5.9]}>
          <C p={[0, 1.4, 0]} r={0.04} h={2.8} c="#475569" />
          <B p={[0, 2.8, 0.3]} s={[0.1, 0.1, 0.7]} c="#475569" />
          <S p={[0, 2.72, 0.6]} r={0.14} c="#fff3c4" e="#ffd27a" />
        </group>
      ))}
      <Walker path={[[-5, 0, 5.8], [5, 0, 5.8]]} speed={0.6} color="#a855f7" offset={4} motion={motion} />

      {/* city backdrop */}
      {buildings.map(([x, h, w], i) => (
        <mesh key={i} position={[x as number, (h as number) / 2 - 0.3, -9]}>
          <boxGeometry args={[w as number, h as number, 2.2]} />
          <meshBasicMaterial map={tex.city} color="#ffffff" />
        </mesh>
      ))}
    </>
  );
}

export default function Scene3D({ stop, reduced, mobile }: { stop: StopId; reduced: boolean; mobile: boolean }) {
  return (
    <Canvas
      dpr={[1, mobile ? 1.25 : 1.75]}
      camera={{ fov: 38, near: 0.1, far: 80, position: STOPS.overview.pos }}
      gl={{ antialias: !mobile, powerPreference: 'high-performance' }}
      frameloop="always"
    >
      <World motion={!reduced} />
      <Rig stop={stop} reduced={reduced} />
    </Canvas>
  );
}
