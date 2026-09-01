import { useLocalSearchParams, useRouter } from 'expo-router';
import { resolvePursuitPattern } from '@candela/shared/rn';
import { LookPursuitGame } from '../../src/games/LookPursuitGame';

export default function ComputerVisionPlayScreen() {
  const router = useRouter();
  const { pattern } = useLocalSearchParams<{ pattern?: string }>();
  return (
    <LookPursuitGame
      movementPattern={resolvePursuitPattern(pattern)}
      onExit={() => router.replace('/dashboard?module=computer_vision')}
    />
  );
}
