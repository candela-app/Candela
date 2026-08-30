import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/lib/auth-context';

WebBrowser.maybeCompleteAuthSession();

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack initialRouteName="index" screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="login" options={{ animation: 'none' }} />
            <Stack.Screen name="signup" options={{ animation: 'none' }} />
            <Stack.Screen name="oauth" options={{ animation: 'none' }} />
            <Stack.Screen name="dashboard" options={{ animation: 'none' }} />
            <Stack.Screen name="docid" options={{ animation: 'none' }} />
            <Stack.Screen name="admin" options={{ animation: 'none' }} />
            <Stack.Screen name="doctor" options={{ animation: 'none' }} />
            <Stack.Screen
              name="play/geoboard"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/rotatory"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/sorting"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/bee"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/pursuit"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/mobile-target"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/peripheral"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/number-search"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/pattern-match"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/direction-sense"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
            <Stack.Screen
              name="play/location-memory"
              options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
            />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
