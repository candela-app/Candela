import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AlphabetVariant, GameMode } from '@candela/shared/rn';
import { RotatoryWheelGame } from '../../src/games/RotatoryWheelGame';

export default function RotatoryPlayScreen() {
  const router = useRouter();
  const { mode, variant } = useLocalSearchParams<{ mode?: string; variant?: string }>();
  return (
    <RotatoryWheelGame
      initialMode={(mode as GameMode) || 'alphabets'}
      initialVariant={(variant as AlphabetVariant) || 'uppercase'}
      onExit={() => router.replace('/dashboard?module=wheel')}
    />
  );
}
