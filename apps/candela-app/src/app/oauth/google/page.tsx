'use client';

import { returnToMobileApp } from '@/lib/mobile-google-return';
import { useEffect } from 'react';

export default function GoogleOAuthRedirectPage() {
  useEffect(() => {
    returnToMobileApp();
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F7FC]">
      <span className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-slate-800 animate-spin" />
    </main>
  );
}
