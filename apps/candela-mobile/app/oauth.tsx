import { useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function OAuthReturnScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id_token?: string | string[] }>();
  const raw = params.id_token;
  const idToken = Array.isArray(raw) ? raw[0] : raw;

  useEffect(() => {
    if (idToken) {
      router.replace({ pathname: '/login', params: { id_token: idToken } } as never);
      return;
    }
    router.replace('/login');
  }, [idToken, router]);

  return null;
}
