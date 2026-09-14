'use client';

import blinkingEyes from '@candela/shared/assets/lottie/blinking-eyes-in-the-dark.json';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react').then((mod) => mod.Lottie), {
  ssr: false,
  loading: () => <div className="w-48 h-36" aria-hidden />,
});

export function ScreenLoader() {
  return (
    <div
      className="min-h-dvh bg-[#06070D] flex flex-col items-center justify-center select-none"
      role="status"
      aria-live="polite"
    >
      <Lottie src={blinkingEyes} loop autoplay className="w-48 h-36" />
      <p className="mt-1 text-sm font-semibold tracking-[0.32em] uppercase text-slate-400">Loading</p>
    </div>
  );
}
