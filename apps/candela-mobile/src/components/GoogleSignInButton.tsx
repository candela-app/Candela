import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../lib/google';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

function GoogleMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <Path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.8-6.1 7.5l6.2 5.2C39 37.3 44 31.5 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </Svg>
  );
}

export function GoogleSignInButton({
  disabled,
  busy,
  onIdToken,
}: {
  disabled?: boolean;
  busy?: boolean;
  onIdToken: (idToken: string) => Promise<void>;
}) {
  const { fs, s } = useLayout();
  const onIdTokenRef = useRef(onIdToken);
  onIdTokenRef.current = onIdToken;
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      return;
    }
    const idToken = response.params.id_token;
    if (idToken) {
      void onIdTokenRef.current(idToken);
    }
  }, [response]);

  return (
    <Pressable
      disabled={disabled || busy}
      onPress={() => void promptAsync()}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: s(12),
        paddingVertical: s(12),
        paddingHorizontal: s(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(10),
        backgroundColor: colors.white,
        minHeight: s(48),
        opacity: disabled && !busy ? 0.6 : 1,
      }}
    >
      {busy ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <GoogleMark size={s(18)} />
          <Text style={{ fontWeight: '700', fontSize: fs(14), color: colors.text }}>Continue with Google</Text>
        </>
      )}
    </Pressable>
  );
}

export function AuthDivider() {
  const { fs, s } = useLayout();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginVertical: s(16) }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted }}>OR</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
