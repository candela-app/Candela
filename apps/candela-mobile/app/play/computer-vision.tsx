import { useRouter } from 'expo-router';
import { GazeHoldGame } from '../../src/games/GazeHoldGame';

export default function ComputerVisionPlayScreen() {
  const router = useRouter();
  const onExit = () => router.replace('/dashboard?module=computer_vision');
  return <GazeHoldGame onExit={onExit} />;
}
