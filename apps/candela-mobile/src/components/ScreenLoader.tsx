import { Text, View } from 'react-native';
import LottieView from 'lottie-react-native';

export function ScreenLoader() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#06070D',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      <LottieView
        source={require('@candela/shared/assets/lottie/blinking-eyes-in-the-dark.json')}
        autoPlay
        loop
        resizeMode="contain"
        style={{ width: 220, height: 140 }}
      />
      <Text
        style={{
          marginTop: 4,
          color: '#94A3B8',
          fontSize: 14,
          fontWeight: '700',
          letterSpacing: 4.5,
          textTransform: 'uppercase',
        }}
      >
        Loading
      </Text>
    </View>
  );
}
