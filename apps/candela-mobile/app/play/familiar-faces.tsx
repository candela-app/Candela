import { useLocalSearchParams, useRouter } from 'expo-router';
import { resolveFamiliarFacesLevelId } from '@candela/shared/rn';
import { FamiliarFacesGame } from '../../src/games/FamiliarFacesGame';

export default function FamiliarFacesPlayScreen() {
  const router = useRouter();
  const { level } = useLocalSearchParams<{ level?: string }>();
  return (
    <FamiliarFacesGame
      levelId={resolveFamiliarFacesLevelId(level)}
      onExit={() => router.replace('/dashboard?module=familiar_faces')}
    />
  );
}
