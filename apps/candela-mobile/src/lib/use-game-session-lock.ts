import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from 'expo-router';

/**
 * Blocks Android back, iOS swipe-back, and stack pops until requestExit().
 * Call requestExit() from Quit; the hook then runs onExit after the lock lifts.
 */
export function useGameSessionLock(onExit?: () => void) {
  const navigation = useNavigation();
  const [allowExit, setAllowExit] = useState(false);
  const allowExitRef = useRef(false);

  useEffect(() => {
    allowExitRef.current = allowExit;
  }, [allowExit]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
    });
  }, [navigation]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current) return;
      e.preventDefault();
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (allowExitRef.current) return false;
      return true;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (allowExit) onExit?.();
  }, [allowExit, onExit]);

  return { requestExit: () => setAllowExit(true) };
}
