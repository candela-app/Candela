import { useLocalSearchParams, useRouter } from 'expo-router';
import type { GeoboardBoardId } from '@candela/shared/rn';
import { GeoboardGame } from '../../src/games/GeoboardGame';

export default function GeoboardPlayScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ board?: string }>();
  const boardId = Math.min(5, Math.max(1, Number(params.board || 1))) as GeoboardBoardId;
  return <GeoboardGame boardId={boardId} onExit={() => router.replace('/dashboard?module=geoboard')} />;
}
