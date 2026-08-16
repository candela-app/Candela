import { useRouter } from 'expo-router';
import { BeeTracingGame } from '../../src/games/BeeTracingGame';

export default function BeePlayScreen() {
  const router = useRouter();
  return <BeeTracingGame onExit={() => router.replace('/dashboard')} />;
}
