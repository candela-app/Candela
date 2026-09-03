import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CATALOG_TO_UI_MODULE,
  GAME_FAMILIES,
  GEOBOARD_BOARD_IDS,
  GEOBOARD_BOARDS,
  MODULE_LEVELS,
  UI_MODULE_TO_CATALOG,
  directionSensePrescribedAllows,
  resolveAllowedModuleIds,
  familyForModuleId,
  getGameFamily,
  isTherapyFamilyId,
  type GeoboardBoardId,
} from '@candela/shared/rn';
import { AnalyticsIcon, EyeIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import { SessionAnalyticsPanel } from '../src/components/SessionAnalyticsPanel';
import { ScreenLoader } from '../src/components/ScreenLoader';
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
  { uiId: 'wheel', title: 'Rotatory Module', body: 'Moving visual search and tap on a spinning wheel', badge: 'For Tabs', accent: '#1D4ED8', bar: '#3B82F6' },
  { uiId: 'sorting', title: 'Sorting Module', body: 'Visual discrimination & sequential recognition', badge: 'For Tabs & Mobile', accent: '#7C3AED', bar: '#8B5CF6' },
  { uiId: 'tracing', title: 'Bee Path Tracing', body: 'Smooth pursuit tracking & visual-motor path control', badge: 'For Touch & Stylus', accent: '#D97706', bar: '#F59E0B' },
  { uiId: 'pursuit', title: 'Pursuit Module', body: 'Continuous visual pursuit & selective attention tracking', badge: 'For All Devices', accent: '#0891B2', bar: '#22D3EE' },
  { uiId: 'mobile_target', title: 'Bubble Chase', body: '2-target bouncing pursuit & dark field tracking', badge: 'For Mobile & Tabs', accent: '#059669', bar: '#34D399' },
  { uiId: 'geoboard', title: 'Draw a Pattern', body: 'Hand-eye coordination & visual spatial recall patterns', badge: 'For All Devices', accent: '#0D9488', bar: '#14B8A6' },
  { uiId: 'peripheral', title: 'Peripheral View', body: 'Hex-hive peripheral field awareness — left, right, or both', badge: 'Landscape only', accent: '#4338CA', bar: '#818CF8' },
  { uiId: 'number_search', title: 'Crowded Search', body: 'Find digits hidden in a crowded field of mixed letters', badge: 'For All Devices', accent: '#B45309', bar: '#F59E0B' },
  { uiId: 'pattern_match', title: 'Hold the Code', body: 'Hold a flashed code and tap every exact match', badge: 'For All Devices', accent: '#BE123C', bar: '#FB7185' },
  { uiId: 'location_memory', title: 'Location Memory', body: 'Explore a grid, then recall where each number was', badge: 'For All Devices', accent: '#D97706', bar: '#FBBF24' },
  { uiId: 'direction_sense', title: 'Direction Sense', body: 'Face & Flip: pick the 90° turn. Straighten: spin the letter to match.', badge: 'For All Devices', accent: '#0284C7', bar: '#38BDF8' },
  { uiId: 'computer_vision', title: 'Gaze Hold', body: 'Look at the still bubble and hold your gaze to pop it', badge: 'For All Devices', accent: '#0E7490', bar: '#22D3EE' },
  { uiId: 'familiar_faces', title: 'Familiar Faces', body: 'Name, find, or hold a face you know', badge: 'For All Devices', accent: '#BE123C', bar: '#FB7185' },
];

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default function DashboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ module?: string; page?: string; family?: string }>();
  const moduleParam = firstParam(params.module);
  const familyParam = firstParam(params.family);
  const pageParam = firstParam(params.page);
  const { session, loading } = useAuth();
  const { fs, s, pad, columns, width } = useLayout();
  const allowedModuleIds = new Set(resolveAllowedModuleIds(session));

  const canPlayUiModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return Boolean(catalogId && allowedModuleIds.has(catalogId));
  };

  const isLevelAllowed = (uiId: string, levelId: string | number) => {
    if (!session || session.user.role !== 'patient') return true;
    if (session.patient?.origin === 'self_signup' || !session.patient?.doctorId) return true;
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    if (!catalogId || !allowedModuleIds.has(catalogId)) return false;
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
    if (catalogId === 'computer_vision') {
      const known = MODULE_LEVELS.computer_vision.map((level) => level.id);
      const hasNewLevels = prescribedLevels.some((id) => known.includes(id));
      if (!hasNewLevels) return true;
    }
    if (catalogId === 'geoboard' && String(levelId) === '6') return true;
    if (catalogId === 'computer_vision' && String(levelId) === 'stationary') return true;
    if (catalogId === 'direction_sense') {
      return directionSensePrescribedAllows(String(levelId), prescribedLevels);
    }
    return prescribedLevels.includes(String(levelId));
  };

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

  const cardWidth = useMemo(
    () => (columns === 1 ? width - pad * 2 : (width - pad * 2 - s(12) * (Math.min(columns, 2) - 1)) / Math.min(columns, 2)),
    [columns, width, pad, s],
  );

  if (session?.user.role !== 'patient') {
    return loading ? <ScreenLoader /> : null;
  }

  const launchRotatory = (mode: string, variant: string) => {
    router.push(`/play/rotatory?mode=${mode}&variant=${variant}`);
  };
  const launchSorting = (variant: string) => {
    router.push(`/play/sorting?variant=${variant}`);
  };
  const launchMobileTarget = (mode: string, variant: string) => {
    router.push(`/play/mobile-target?mode=${mode}&variant=${variant}`);
  };
  const launchGeoboard = (boardId: GeoboardBoardId) => {
    router.push(`/play/geoboard?boardId=${boardId}` as never);
  };
  const launchBee = (pathType: string) => {
    router.push(`/play/bee?pathType=${pathType}` as never);
  };
  const launchPursuit = (pattern: string) => {
    router.push(`/play/pursuit?pattern=${pattern}` as never);
  };
  const launchPeripheral = (field: string) => {
    router.push(`/play/peripheral?field=${field}` as never);
  };
  const launchNumberSearch = () => {
    router.push('/play/number-search' as never);
  };
  const launchPatternMatch = (levelId: string = 'standard') => {
    router.push(`/play/pattern-match?level=${levelId}` as never);
  };
  const launchDirectionSense = (levelId: string = 'face') => {
    router.push(`/play/direction-sense?level=${levelId}` as never);
  };
  const launchLocationMemory = (levelId: string = 'standard') => {
    router.push(`/play/location-memory?level=${levelId}` as never);
  };
  const launchComputerVision = (pattern: string) => {
    router.push(`/play/computer-vision?pattern=${pattern}` as never);
  };
  const launchFamiliarFaces = (levelId: string = 'name_it') => {
    router.push(`/play/familiar-faces?level=${levelId}` as never);
  };

  const backToModules = () => router.replace('/dashboard');
  const activeFamilyId =
    (familyParam && isTherapyFamilyId(familyParam) ? familyParam : null) ||
    familyForModuleId(UI_MODULE_TO_CATALOG[moduleParam ?? ''] ?? '')?.id ||
    null;
  const backToFamily = () => {
    if (activeFamilyId) {
      router.replace(`/dashboard?family=${activeFamilyId}`);
      return;
    }
    backToModules();
  };

  const variantCard = (label: string, onPress: () => void) => (
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

  const noLevelsCard = (title: string) => (
    <View style={{ width: '100%', backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ fontSize: fs(18), fontWeight: '700', marginBottom: s(8) }}>{title}</Text>
      <Text style={{ fontSize: fs(13), color: colors.muted, textAlign: 'center' }}>
        Your doctor has not enabled any specific levels for this module.
      </Text>
    </View>
  );

  if (pageParam === 'analytics') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginBottom: s(16) }}>
            <View style={{ width: s(40), height: s(40), borderRadius: s(12), backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
              <AnalyticsIcon size={s(22)} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(22), fontWeight: '800' }}>
                {session?.user.name ? `${session.user.name}'s Session Analytics` : 'Session Analytics'}
              </Text>
              <Text style={{ fontSize: fs(13), color: colors.muted }}>Review past session performance across all therapy modules</Text>
            </View>
          </View>
          <SessionAnalyticsPanel patientName={session?.user.name || 'you'} />
          <Pressable
            onPress={() => router.replace('/dashboard')}
            style={{
              marginTop: s(16),
              alignSelf: 'flex-start',
              backgroundColor: colors.blue,
              borderRadius: s(12),
              paddingHorizontal: s(20),
              paddingVertical: s(12),
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <EyeIcon size={s(18)} color="#fff" />
            <Text style={{ color: colors.white, fontWeight: '700' }}>Start a Therapy Session</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'wheel' && canPlayUiModule('wheel')) {
    const levels = [
      isLevelAllowed('wheel', 'uppercase') ? variantCard('Uppercase Rotatory', () => launchRotatory('alphabets', 'uppercase')) : null,
      isLevelAllowed('wheel', 'lowercase') ? variantCard('Lowercase Rotatory', () => launchRotatory('alphabets', 'lowercase')) : null,
      isLevelAllowed('wheel', 'numbers') ? variantCard('Numeric Rotatory', () => launchRotatory('numbers', 'uppercase')) : null,
      isLevelAllowed('wheel', 'colors') ? variantCard('Color Discriminant', () => launchRotatory('colors', 'uppercase')) : null,
    ].filter(Boolean);
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Rotatory Module</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select an exercise mode to begin</Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'sorting' && canPlayUiModule('sorting')) {
    const levels = [
      isLevelAllowed('sorting', 'uppercase') ? variantCard('Uppercase Alphabet Sorting', () => launchSorting('uppercase')) : null,
      isLevelAllowed('sorting', 'lowercase') ? variantCard('Lowercase Alphabet Sorting', () => launchSorting('lowercase')) : null,
      isLevelAllowed('sorting', 'numbers') ? variantCard('Numeric Sorting', () => launchSorting('numbers')) : null,
    ].filter(Boolean);
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Sorting Module</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a sorting category to begin</Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'mobile_target' && canPlayUiModule('mobile_target')) {
    const levels = [
      isLevelAllowed('mobile_target', 'uppercase') ? variantCard('Uppercase Bubble Chase', () => launchMobileTarget('alphabets', 'uppercase')) : null,
      isLevelAllowed('mobile_target', 'lowercase') ? variantCard('Lowercase Bubble Chase', () => launchMobileTarget('alphabets', 'lowercase')) : null,
      isLevelAllowed('mobile_target', 'numbers') ? variantCard('Numeric Bubble Chase', () => launchMobileTarget('numbers', 'uppercase')) : null,
      isLevelAllowed('mobile_target', 'colors') ? variantCard('Color Discriminant Bubble Chase', () => launchMobileTarget('colors', 'uppercase')) : null,
    ].filter(Boolean);
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Bubble Chase</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select an exercise mode to begin</Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'tracing' && canPlayUiModule('tracing')) {
    const levels = MODULE_LEVELS.bee_tracing
      .filter((level) => isLevelAllowed('tracing', level.id))
      .map((level) => variantCard(level.name, () => launchBee(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Bee Path Tracing</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a path type to begin</Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'pursuit' && canPlayUiModule('pursuit')) {
    const levels = MODULE_LEVELS.pursuit
      .filter((level) => isLevelAllowed('pursuit', level.id))
      .map((level) => variantCard(level.name, () => launchPursuit(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Pursuit Module</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a movement pattern to begin</Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'geoboard' && canPlayUiModule('geoboard')) {
    const levels = GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).map((id) =>
      variantCard(GEOBOARD_BOARDS[id].shortLabel, () => launchGeoboard(id)),
    );
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Draw a Pattern</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>Select a board to begin</Text>
          {levels.length === 0 ? noLevelsCard('No boards assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'peripheral' && canPlayUiModule('peripheral')) {
    const levels = MODULE_LEVELS.peripheral_view
      .filter((level) => isLevelAllowed('peripheral', level.id))
      .map((level) => variantCard(level.name, () => launchPeripheral(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Peripheral View</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Select a visual field · designed for landscape
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'number_search' && canPlayUiModule('number_search')) {
    const levels = MODULE_LEVELS.number_search
      .filter((level) => isLevelAllowed('number_search', level.id))
      .map((level) => variantCard(level.name, () => launchNumberSearch()));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Crowded Search</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Find digits hidden among mixed letters
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'pattern_match' && canPlayUiModule('pattern_match')) {
    const levels = MODULE_LEVELS.pattern_match
      .filter((level) => isLevelAllowed('pattern_match', level.id))
      .map((level) => variantCard(level.name, () => launchPatternMatch(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Hold the Code</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Hold a code — tap every exact match
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'computer_vision' && canPlayUiModule('computer_vision')) {
    const levels = MODULE_LEVELS.computer_vision
      .filter((level) => isLevelAllowed('computer_vision', level.id))
      .map((level) => variantCard(level.name, () => launchComputerVision(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Gaze Hold</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Look at the still bubble and hold your gaze to pop it
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'familiar_faces' && canPlayUiModule('familiar_faces')) {
    const levels = MODULE_LEVELS.familiar_faces
      .filter((level) => isLevelAllowed('familiar_faces', level.id))
      .map((level) => variantCard(level.name, () => launchFamiliarFaces(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Familiar Faces</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Add family photos, then name, find, or hold a face
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'direction_sense' && canPlayUiModule('direction_sense')) {
    const levels = MODULE_LEVELS.direction_sense
      .filter((level) => isLevelAllowed('direction_sense', level.id))
      .map((level) => variantCard(level.name, () => launchDirectionSense(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Direction Sense</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Face & Flip: pick the 90° turn. Straighten: spin the letter to match.
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  if (moduleParam === 'location_memory' && canPlayUiModule('location_memory')) {
    const levels = MODULE_LEVELS.location_memory
      .filter((level) => isLevelAllowed('location_memory', level.id))
      .map((level) => variantCard(level.name, () => launchLocationMemory(level.id)));
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToFamily} />
        <ScrollView contentContainerStyle={{ padding: pad }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800', marginBottom: s(4) }}>Location Memory</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
            Explore the grid, then recall each number
          </Text>
          {levels.length === 0 ? noLevelsCard('No levels assigned yet') : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>{levels}</View>}
        </ScrollView>
      </View>
    );
  }

  const visibleFamilies = GAME_FAMILIES.filter((family) =>
    family.moduleIds.some((catalogId) => canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId])),
  );
  const selectedFamily = familyParam && isTherapyFamilyId(familyParam) ? getGameFamily(familyParam) : undefined;
  const familyActivityCards = (selectedFamily?.moduleIds ?? [])
    .map((catalogId) => MODULE_CARDS.find((card) => card.uiId === CATALOG_TO_UI_MODULE[catalogId]))
    .filter((card): card is ModuleCard => Boolean(card && canPlayUiModule(card.uiId)));

  const handleSelectFamily = (id: string) => {
    router.push(`/dashboard?family=${id}`);
  };

  const handleSelectModule = (id: string) => {
    if (!canPlayUiModule(id)) return;
    const family =
      (familyParam && isTherapyFamilyId(familyParam) ? familyParam : null) ||
      familyForModuleId(UI_MODULE_TO_CATALOG[id] ?? '')?.id;
    router.push(family ? `/dashboard?family=${family}&module=${id}` : `/dashboard?module=${id}`);
  };

  const gridCard = (
    key: string,
    title: string,
    body: string,
    accent: string,
    bar: string,
    badge: string,
    onPress: () => void,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
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
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, backgroundColor: bar }} />
      <View>
        <Text style={{ fontSize: fs(18), fontWeight: '700', color: colors.ink, marginTop: s(8) }}>{title}</Text>
        <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(6) }}>{body}</Text>
      </View>
      <Text
        style={{
          alignSelf: 'center',
          fontSize: fs(10),
          fontWeight: '700',
          color: accent,
          backgroundColor: `${accent}14`,
          paddingHorizontal: s(10),
          paddingVertical: s(4),
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        {badge}
      </Text>
    </Pressable>
  );

  if (selectedFamily) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={backToModules} />
        <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
          <Text style={{ fontSize: fs(22), fontWeight: '800' }}>{selectedFamily.title}</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4), marginBottom: s(16) }}>
            {selectedFamily.body}
          </Text>
          {familyActivityCards.length === 0 ? (
            <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No activities prescribed yet</Text>
              <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
                Your doctor has not added any games in this family.
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
              {familyActivityCards.map((card) =>
                gridCard(card.uiId, card.title, card.body, card.accent, card.bar, card.badge, () => handleSelectModule(card.uiId)),
              )}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
          <View style={{ flex: 1, paddingRight: s(8) }}>
            <Text style={{ fontSize: fs(22), fontWeight: '800' }}>Vision Therapy</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted }}>Pick a family, then an activity</Text>
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
          <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(28), alignItems: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: s(16) }}>
            <Text style={{ fontSize: fs(18), fontWeight: '700' }}>No modules prescribed yet</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), textAlign: 'center' }}>
              Your doctor has not added any therapy modules. Check back after they prescribe one.
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {visibleFamilies.map((family) => {
            const playableCount = family.moduleIds.filter((catalogId) =>
              canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId]),
            ).length;
            return gridCard(
              family.id,
              family.title,
              family.body,
              family.accent,
              family.bar,
              `${playableCount} ${playableCount === 1 ? 'activity' : 'activities'}`,
              () => handleSelectFamily(family.id),
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
