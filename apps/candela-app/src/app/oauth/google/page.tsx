'use client';

import { ScreenLoader } from '@/components/common/ScreenLoader';
import { returnToMobileApp } from '@/lib/mobile-google-return';
import { useEffect } from 'react';

export default function GoogleOAuthRedirectPage() {
  useEffect(() => {
    returnToMobileApp();
  }, []);

  return <ScreenLoader />;
}
