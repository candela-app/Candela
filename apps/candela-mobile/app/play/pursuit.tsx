import { useLocalSearchParams, useRouter } from 'expo-router';
import { resolvePursuitPattern } from '@candela/shared/rn';
import { PursuitGame } from '../../src/games/PursuitGame';

export default function PursuitPlayScreen() {
  const router = useRouter();
  const { pattern } = useLocalSearchParams<{ pattern?: string }>();
  return (
    <PursuitGame
      movementPattern={resolvePursuitPattern(pattern)}
      onExit={() => router.replace('/dashboard?module=pursuit')}
    />
  );
}
