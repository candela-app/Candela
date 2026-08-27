import { useLocalSearchParams, useRouter } from 'expo-router';
import { LocationMemoryGame } from '../../src/games/LocationMemoryGame';

export default function LocationMemoryPlayScreen() {
  const router = useRouter();
  const { level } = useLocalSearchParams<{ level?: string }>();
  const levelId = level === 'practice' ? 'practice' : level === 'match' ? 'match' : 'standard';
  return (
    <LocationMemoryGame
      levelId={levelId}
      onExit={() => router.replace('/dashboard?module=location_memory')}
    />
  );
}
