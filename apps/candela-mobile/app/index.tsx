import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppHeader } from '../src/components/AppHeader';
import { HomePageContent } from '../src/components/HomePageContent';
import { roleHomePath, useAuth } from '../src/lib/auth-context';
import { colors } from '../src/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useAuth();

  const goToDashboard = () => {
    if (!session) {
      router.push('/login');
      return;
    }
    router.push(roleHomePath(session.user.role) as never);
  };

  const selectModule = (id: string) => {
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.push(roleHomePath(session.user.role) as never);
      return;
    }
    if (id === 'tracing') {
      router.push('/play/bee');
    } else if (id === 'pursuit') {
      router.push('/play/pursuit');
    } else if (id === 'wheel') {
      router.push('/dashboard?module=wheel');
    } else if (id === 'sorting') {
      router.push('/dashboard?module=sorting');
    } else if (id === 'geoboard') {
      router.push('/dashboard?module=geoboard');
    } else {
      router.push('/dashboard?module=mobile_target');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader />
      <HomePageContent onOpenDashboard={goToDashboard} onSelectModule={selectModule} />
    </View>
  );
}
