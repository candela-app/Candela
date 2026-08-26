import { useRouter } from 'expo-router';
import { NumberSearchGame } from '../../src/games/NumberSearchGame';

export default function NumberSearchPlayScreen() {
  const router = useRouter();
  return (
    <NumberSearchGame onExit={() => router.replace('/dashboard?module=number_search')} />
  );
}
