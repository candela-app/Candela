import { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { UI_MODULE_TO_CATALOG, MODULE_LEVELS } from '@candela/shared/rn';
import { AnalyticsIcon, EyeIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

type ModuleCard = {
  uiId: string;
  title: string;
  body: string;
  badge: string;
  accent: string;
  bar: string;
};

const MODULE_CARDS: ModuleCard[] = [
  { uiId: 'wheel', title: 'Rotatory Module', body: 'Dynamic wheel tracking & visual pursuit exercises', badge: 'For Tabs', accent: '#1D4ED8', bar: '#3B82F6' },
  { uiId: 'sorting', title: 'Sorting Module', body: 'Visual discrimination & sequential recognition', badge: 'For Tabs & Mobile', accent: '#7C3AED', bar: '#8B5CF6' },
  { uiId: 'tracing', title: 'Bee Path Tracing', body: 'Smooth pursuit tracking & visual-motor path control', badge: 'For Touch & Stylus', accent: '#D97706', bar: '#F59E0B' },
  { uiId: 'pursuit', title: 'Pursuit Module', body: 'Continuous visual pursuit & selective attention tracking', badge: 'For All Devices', accent: '#0891B2', bar: '#22D3EE' },
  { uiId: 'mobile_target', title: 'Bubble Chase', body: '2-target bouncing pursuit & dark field tracking', badge: 'For Mobile & Tabs', accent: '#059669', bar: '#34D399' },
  { uiId: 'geoboard', title: 'Draw a Pattern', body: 'Digitized pattern reproduction for hand-eye coordination', badge: 'For All Devices', accent: '#0D9488', bar: '#14B8A6' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ module?: string; page?: string }>();
  const { session, loading } = useAuth();
  const { fs, s, pad, columns, width } = useLayout();
  const allowedModuleIds = new Set(session?.allowedModuleIds ?? []);
  const canPlayUiModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return Boolean(catalogId && allowedModuleIds.has(catalogId));
  };

  const isLevelAllowed = (uiId: string, levelId: string | number) => {
    if (!session || session.user.role !== 'patient') return true;
    if (session.patient?.origin === 'self_signup' || !session.patient?.doctorId) return true;
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    if (!catalogId) return false;
    if (!allowedModuleIds.has(catalogId)) return false;
    const prescribedLevels = session.patient?.prescribedLevels?.[catalogId];
    if (prescribedLevels === undefined) return true;
    if (catalogId === 'bee_tracing') {
      const known = MODULE_LEVELS.bee_tracing.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'pursuit') {
      const known = MODULE_LEVELS.pursuit.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    return prescribedLevels.includes(String(levelId));
  };

  const emptyLevels = (
    <View
      style={{
        width: '100%',
        backgroundColor: colors.white,
        borderRadius: s(20),
        padding: s(24),
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No levels assigned yet</Text>
      <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
        Your doctor has not enabled any specific levels for this module.
      </Text>
    </View>
  );

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.user.role === 'admin') {
      router.replace('/admin');
      return;
    }
    if (session.user.role === 'doctor') {
      router.replace('/doctor');
    }
  }, [loading, session, router]);

  if (loading || !session || session.user.role !== 'patient') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader />
        <Text style={{ padding: 32, textAlign: 'center', color: colors.muted, fontWeight: '600' }}>Loading…</Text>
      </View>
    );
  }

  const cardWidth =
    columns === 1 ? width - pad * 2 : (width - pad * 2 - s(12) * (Math.min(columns, 2) - 1)) / Math.min(columns, 2);

  const launchRotatory = (mode: string, variant: string) => {
    router.push(`/play/rotatory?mode=${mode}&variant=${variant}`);
  };
  const launchSorting = (variant: string) => {
    router.push(`/play/sorting?variant=${variant}`);
  };
  const launchBee = (pathType: string) => {
    router.push(`/play/bee?pathType=${pathType}`);
  };
  const launchMobileTarget = (mode: string, variant: string) => {
    router.push(`/play/mobile-target?mode=${mode}&variant=${variant}`);
  };
  const launchGeoboard = (boardId: number) => {
    router.push(`/play/geoboard?boardId=${boardId}`);
  };
  const launchPursuit = (pattern: string) => {
    router.push(`/play/pursuit?pattern=${pattern}`);
  };

  const variantCard = (label: string, onPress: () => void, accent: string) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={{
        width: cardWidth,
        minHeight: s(140),
        borderRadius: s(16),
        backgroundColor: colors.white,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        padding: s(16),
        marginBottom: s(12),
      }}
    >
      <Text style={{ fontSize: fs(18), fontWeight: '600', color: colors.ink, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );

  const backToModules = () => router.replace('/dashboard');

  if (params.page === 'analytics') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), alignSelf: 'flex-start', marginBottom: s(24) }}>
            <View style={{ width: s(40), height: s(40), borderRadius: s(12), backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
              <AnalyticsIcon size={s(22)} color={colors.blue} />
            </View>
            <View>
              <Text style={{ fontSize: fs(22), fontWeight: '800' }}>Session Analytics</Text>
              <Text style={{ fontSize: fs(13), color: colors.muted }}>Review past session performance across all therapy modules</Text>
            </View>
          </View>
          <View style={{ width: s(88), height: s(88), borderRadius: s(24), backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: s(16) }}>
            <AnalyticsIcon size={s(48)} color="#60A5FA" />
          </View>
          <Text style={{ fontSize: fs(18), fontWeight: '700', marginBottom: s(8) }}>No Session Data Yet</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, textAlign: 'center', marginBottom: s(20) }}>
            Complete therapy sessions to see your performance analytics here. Session results including accuracy, reaction times, and progress tracking will appear on this page.
          </Text>
          <Pressable
            onPress={() => router.replace('/dashboard')}
            style={{ backgroundColor: colors.blue, borderRadius: s(12), paddingHorizontal: s(20), paddingVertical: s(12), flexDirection: 'row', alignItems: 'center', gap: s(8) }}
          >
            <EyeIcon size={s(18)} color="#fff" />
            <Text style={{ color: colors.white, fontWeight: '700' }}>Start a Therapy Session</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (params.module === 'wheel' && canPlayUiModule('wheel')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {isLevelAllowed('wheel', 'uppercase')
            ? variantCard('Uppercase Rotatory', () => launchRotatory('alphabets', 'uppercase'), '#2563EB')
            : null}
          {isLevelAllowed('wheel', 'lowercase')
            ? variantCard('Lowercase Rotatory', () => launchRotatory('alphabets', 'lowercase'), '#2563EB')
            : null}
          {isLevelAllowed('wheel', 'numbers')
            ? variantCard('Numeric Rotatory', () => launchRotatory('numbers', 'uppercase'), '#2563EB')
            : null}
          {isLevelAllowed('wheel', 'colors')
            ? variantCard('Color Discriminant', () => launchRotatory('colors', 'uppercase'), '#2563EB')
            : null}
          {!isLevelAllowed('wheel', 'uppercase') &&
          !isLevelAllowed('wheel', 'lowercase') &&
          !isLevelAllowed('wheel', 'numbers') &&
          !isLevelAllowed('wheel', 'colors')
            ? emptyLevels
            : null}
        </ScrollView>
      </View>
    );
  }

  if (params.module === 'sorting' && canPlayUiModule('sorting')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {isLevelAllowed('sorting', 'uppercase')
            ? variantCard('Uppercase Alphabet Sorting', () => launchSorting('uppercase'), '#7C3AED')
            : null}
          {isLevelAllowed('sorting', 'lowercase')
            ? variantCard('Lowercase Alphabet Sorting', () => launchSorting('lowercase'), '#7C3AED')
            : null}
          {isLevelAllowed('sorting', 'numbers')
            ? variantCard('Numeric Sorting', () => launchSorting('numbers'), '#7C3AED')
            : null}
          {!isLevelAllowed('sorting', 'uppercase') &&
          !isLevelAllowed('sorting', 'lowercase') &&
          !isLevelAllowed('sorting', 'numbers')
            ? emptyLevels
            : null}
        </ScrollView>
      </View>
    );
  }

  if (params.module === 'mobile_target' && canPlayUiModule('mobile_target')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {isLevelAllowed('mobile_target', 'uppercase')
            ? variantCard('Uppercase Bubble Chase', () => launchMobileTarget('alphabets', 'uppercase'), '#059669')
            : null}
          {isLevelAllowed('mobile_target', 'lowercase')
            ? variantCard('Lowercase Bubble Chase', () => launchMobileTarget('alphabets', 'lowercase'), '#059669')
            : null}
          {isLevelAllowed('mobile_target', 'numbers')
            ? variantCard('Numeric Bubble Chase', () => launchMobileTarget('numbers', 'uppercase'), '#059669')
            : null}
          {isLevelAllowed('mobile_target', 'colors')
            ? variantCard('Color Discriminant Bubble Chase', () => launchMobileTarget('colors', 'uppercase'), '#059669')
            : null}
          {!isLevelAllowed('mobile_target', 'uppercase') &&
          !isLevelAllowed('mobile_target', 'lowercase') &&
          !isLevelAllowed('mobile_target', 'numbers') &&
          !isLevelAllowed('mobile_target', 'colors')
            ? emptyLevels
            : null}
        </ScrollView>
      </View>
    );
  }

  if (params.module === 'tracing' && canPlayUiModule('tracing')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {MODULE_LEVELS.bee_tracing.map((level) =>
            isLevelAllowed('tracing', level.id)
              ? variantCard(level.name, () => launchBee(level.id), '#D97706')
              : null,
          )}
          {MODULE_LEVELS.bee_tracing.every((level) => !isLevelAllowed('tracing', level.id)) ? emptyLevels : null}
        </ScrollView>
      </View>
    );
  }

  if (params.module === 'geoboard' && canPlayUiModule('geoboard')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {MODULE_LEVELS.geoboard.map((level) =>
            isLevelAllowed('geoboard', level.id)
              ? variantCard(level.name, () => launchGeoboard(Number(level.id)), '#0D9488')
              : null,
          )}
          {MODULE_LEVELS.geoboard.every((level) => !isLevelAllowed('geoboard', level.id)) ? emptyLevels : null}
        </ScrollView>
      </View>
    );
  }

  if (params.module === 'pursuit' && canPlayUiModule('pursuit')) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {MODULE_LEVELS.pursuit.map((level) =>
            isLevelAllowed('pursuit', level.id)
              ? variantCard(level.name, () => launchPursuit(level.id), '#0891B2')
              : null,
          )}
          {MODULE_LEVELS.pursuit.every((level) => !isLevelAllowed('pursuit', level.id)) ? emptyLevels : null}
        </ScrollView>
      </View>
    );
  }

  const handleSelectModule = (id: string) => {
    if (!canPlayUiModule(id)) return;
    router.push(`/dashboard?module=${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
          <View>
            <Text style={{ fontSize: fs(22), fontWeight: '800' }}>Vision Therapy</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted }}>Select a therapy module to begin</Text>
          </View>
          <Pressable
            onPress={() => router.push('/dashboard?page=analytics')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(6),
              backgroundColor: colors.white,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: s(12),
              paddingHorizontal: s(12),
              paddingVertical: s(8),
            }}
          >
            <AnalyticsIcon size={s(18)} color={colors.blue} />
            <Text style={{ fontWeight: '600', fontSize: fs(13) }}>Analytics</Text>
          </Pressable>
        </View>

        {allowedModuleIds.size === 0 ? (
          <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No modules prescribed yet</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
              Your doctor has not added any therapy modules. Check back after they prescribe one.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {MODULE_CARDS.filter((card) => canPlayUiModule(card.uiId)).map((card) => (
            <Pressable
              key={card.uiId}
              onPress={() => handleSelectModule(card.uiId)}
              style={{
                width: cardWidth,
                minHeight: s(160),
                backgroundColor: colors.white,
                borderRadius: s(22),
                padding: s(20),
                borderWidth: 1,
                borderColor: colors.border,
                justifyContent: 'space-between',
                overflow: 'hidden',
              }}
            >
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: card.bar }} />
              <View>
                <Text style={{ fontSize: fs(18), fontWeight: '700', color: colors.ink, marginTop: s(8) }}>{card.title}</Text>
                <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(6) }}>{card.body}</Text>
              </View>
              <Text
                style={{
                  alignSelf: 'center',
                  fontSize: fs(10),
                  fontWeight: '700',
                  color: card.accent,
                  backgroundColor: `${card.accent}14`,
                  paddingHorizontal: s(10),
                  paddingVertical: s(4),
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                {card.badge}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
