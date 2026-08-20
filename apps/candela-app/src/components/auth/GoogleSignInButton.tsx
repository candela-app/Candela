'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GOOGLE_WEB_CLIENT_ID } from '@/lib/google';

type GoogleTokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => GoogleTokenClient;
        };
      };
    };
  }
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.1 7.5l6.2 5.2C39 37.3 44 31.5 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function GoogleSignInButton({
  onAccessToken,
  disabled,
  busy,
}: {
  onAccessToken: (accessToken: string) => Promise<void>;
  disabled?: boolean;
  busy?: boolean;
}) {
  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const onAccessTokenRef = useRef(onAccessToken);
  onAccessTokenRef.current = onAccessToken;
  const [ready, setReady] = useState(false);

  const init = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      return;
    }
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error || !response.access_token) {
          return;
        }
        void onAccessTokenRef.current(response.access_token);
      },
    });
    setReady(true);
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  function onClick() {
    if (disabled || busy || !tokenClientRef.current) {
      return;
    }
    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
  }

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={init} />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || busy || !ready}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-900 min-h-[48px] mt-1 disabled:opacity-80"
      >
        {busy ? (
          <span className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-gray-800 animate-spin" aria-label="Signing in" />
        ) : (
          <>
            <GoogleMark />
            Continue with Google
          </>
        )}
      </button>
    </>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs font-semibold text-gray-400 uppercase">or</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
