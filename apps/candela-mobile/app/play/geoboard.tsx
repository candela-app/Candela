import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
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
  const { boardId, board } = useLocalSearchParams<{ boardId?: string; board?: string }>();
  const raw = Array.isArray(boardId) ? boardId[0] : boardId ?? (Array.isArray(board) ? board[0] : board);
  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false,
          fullScreenGestureEnabled: false,
          animation: 'fade',
        }}
      />
      <GeoboardGame
        boardId={resolveBoardId(raw)}
        onExit={() => router.replace('/dashboard?module=geoboard')}
      />
    </>
  );
}
