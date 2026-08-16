import { useRouter } from 'expo-router';
import { PursuitGame } from '../../src/games/PursuitGame';

export default function PursuitPlayScreen() {
  const router = useRouter();
  return <PursuitGame onExit={() => router.replace('/dashboard')} />;
}
