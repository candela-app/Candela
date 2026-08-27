import { useLocalSearchParams, useRouter } from 'expo-router';
import { normalizeDirectionSenseLevelId } from '@candela/shared/rn';
import { DirectionSenseGame } from '../../src/games/DirectionSenseGame';

export default function DirectionSensePlayScreen() {
  const router = useRouter();
  const { level } = useLocalSearchParams<{ level?: string }>();
  const levelId = normalizeDirectionSenseLevelId(level);
  return (
    <DirectionSenseGame
      levelId={levelId}
      onExit={() => router.replace('/dashboard?module=direction_sense')}
    />
  );
}
