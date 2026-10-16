'use client';

import React, { useEffect, useState } from 'react';
import Landing3D from './Landing3D';
import LandingSvg from './LandingSvg';
import SiteFooter from '@/components/public/SiteFooter';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// 3D miniature restaurant when the device supports WebGL, otherwise the lightweight SVG version.
export default function Landing() {
  const [mode, setMode] = useState<'check' | '3d' | 'svg'>('check');
  useEffect(() => setMode(hasWebGL() ? '3d' : 'svg'), []);
  if (mode === 'check') return <div className="min-h-screen bg-[#f3ede0]" />;
  return <>{mode === '3d' ? <Landing3D /> : <LandingSvg />}<SiteFooter /></>;
}
