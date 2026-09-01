import { Redirect } from 'expo-router';
import { ScreenLoader } from '../src/components/ScreenLoader';
import { roleHomePath, useAuth } from '../src/lib/auth-context';

export default function HomeScreen() {
  const { session, loading } = useAuth();

  if (loading) {
    return <ScreenLoader />;
  }

  if (session) {
    return <Redirect href={roleHomePath(session.user.role) as never} />;
  }

  return <Redirect href="/login" />;
}
