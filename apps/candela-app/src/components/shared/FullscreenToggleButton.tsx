'use client';

import React, { useEffect, useState } from 'react';
import { exitFullScreenSafe, requestFullScreenSafe } from '@candela/shared';

function isDocumentFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return !!(document.fullscreenElement || doc.webkitFullscreenElement);
}

export function FullscreenToggleButton({ className = '' }: { className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(isDocumentFullscreen());
    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        if (isDocumentFullscreen()) exitFullScreenSafe();
        else requestFullScreenSafe();
      }}
      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#121626]/90 hover:bg-[#1A2035] border border-gray-800/90 hover:border-gray-700 text-gray-300 hover:text-white flex items-center justify-center shadow-md transition-all cursor-pointer backdrop-blur-md active:scale-95 ${className}`}
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
      )}
    </button>
  );
}
