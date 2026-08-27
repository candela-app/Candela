import { useLocalSearchParams, useRouter } from 'expo-router';
import { PatternMatchGame } from '../../src/games/PatternMatchGame';

export default function PatternMatchPlayScreen() {
  const router = useRouter();
  const { level } = useLocalSearchParams<{ level?: string }>();
  const levelId = level === 'compound' ? 'compound' : 'standard';
  return (
    <PatternMatchGame
      levelId={levelId}
      onExit={() => router.replace('/dashboard?module=pattern_match')}
    />
  );
}
