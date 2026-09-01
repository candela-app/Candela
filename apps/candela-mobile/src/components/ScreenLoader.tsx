import { ActivityIndicator, View } from 'react-native';
import { colors } from '../lib/theme';

export function ScreenLoader() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}
