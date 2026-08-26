import { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PeripheralViewGame } from '../../src/games/PeripheralViewGame';

export default function PeripheralPlayScreen() {
  const router = useRouter();
  const { field } = useLocalSearchParams<{ field?: string }>();
  const onExit = useCallback(() => {
    router.replace('/dashboard?module=peripheral');
  }, [router]);

  return <PeripheralViewGame field={field || 'both'} onExit={onExit} />;
}
