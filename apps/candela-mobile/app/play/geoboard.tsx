import { useLocalSearchParams, useRouter } from 'expo-router';
import type { GeoboardBoardId } from '@candela/shared/rn';
import { GEOBOARD_BOARD_IDS } from '@candela/shared/rn';
import { GeoboardGame } from '../../src/games/GeoboardGame';

function resolveBoardId(value?: string): GeoboardBoardId {
  const n = Number(value);
  if (GEOBOARD_BOARD_IDS.includes(n as GeoboardBoardId)) return n as GeoboardBoardId;
  return 1;
}

export default function GeoboardPlayScreen() {
  const router = useRouter();
  const { boardId } = useLocalSearchParams<{ boardId?: string }>();
  return (
    <GeoboardGame
      boardId={resolveBoardId(Array.isArray(boardId) ? boardId[0] : boardId)}
      onExit={() => router.replace('/dashboard?module=geoboard')}
    />
  );
}
