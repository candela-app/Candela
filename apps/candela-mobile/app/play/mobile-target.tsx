import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AlphabetVariant, GameMode } from '@candela/shared/rn';
import { MobileTargetGame } from '../../src/games/MobileTargetGame';

export default function MobileTargetPlayScreen() {
  const router = useRouter();
  const { mode, variant } = useLocalSearchParams<{ mode?: string; variant?: string }>();
  return (
    <MobileTargetGame
      initialMode={(mode as GameMode) || 'alphabets'}
      initialVariant={(variant as AlphabetVariant) || 'uppercase'}
      onExit={() => router.replace('/dashboard?module=mobile_target')}
    />
  );
}
