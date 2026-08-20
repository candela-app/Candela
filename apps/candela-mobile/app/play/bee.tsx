import { useLocalSearchParams, useRouter } from 'expo-router';
import { resolveBeePathType } from '@candela/shared/rn';
import { BeeTracingGame } from '../../src/games/BeeTracingGame';

export default function BeePlayScreen() {
  const router = useRouter();
  const { pathType } = useLocalSearchParams<{ pathType?: string }>();
  return (
    <BeeTracingGame
      initialPathType={resolveBeePathType(pathType)}
      onExit={() => router.replace('/dashboard?module=tracing')}
    />
  );
}
