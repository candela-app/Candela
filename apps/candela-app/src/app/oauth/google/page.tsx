'use client';

import { returnToMobileApp } from '@/lib/mobile-google-return';
import { useEffect, useState } from 'react';

export default function GoogleOAuthRedirectPage() {
  const [message, setMessage] = useState('Returning to Kandela…');

  useEffect(() => {
    if (!returnToMobileApp()) {
      setMessage('Signed in. Return to the Kandela app.');
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F4F7FC] px-6">
      <p className="text-sm font-semibold text-slate-600 text-center">{message}</p>
    </main>
  );
}
