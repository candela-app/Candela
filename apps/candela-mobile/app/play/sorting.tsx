import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SortingVariant } from '@candela/shared/rn';
import { SortingGame } from '../../src/games/SortingGame';

export default function SortingPlayScreen() {
  const router = useRouter();
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  return (
    <SortingGame
      variant={(variant as SortingVariant) || 'uppercase'}
      onExit={() => router.replace('/dashboard?module=sorting')}
    />
  );
}
