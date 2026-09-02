'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotatoryWheelGame } from '@/components/rotatoryModule/RotatoryWheelGame';
import { SortingGame } from '@/components/sortingModule/SortingGame';
import { BeeTracingGame } from '@/components/beeTrackingModule/BeeTracingGame';
import { PursuitGame } from '@/components/pursuitModule/PursuitGame';
import { MobileTargetGame } from '@/components/mobileTargetModule/MobileTargetGame';
import { GeoboardGame } from '@/components/geoboardModule/GeoboardGame';
import { PeripheralViewGame } from '@/components/peripheralViewModule/PeripheralViewGame';
import { NumberSearchGame } from '@/components/numberSearchModule/NumberSearchGame';
import { PatternMatchGame } from '@/components/patternMatchModule/PatternMatchGame';
import { LocationMemoryGame } from '@/components/locationMemoryModule/LocationMemoryGame';
import { DirectionSenseGame } from '@/components/directionSenseModule/DirectionSenseGame';
import { GazeHoldGame } from '@/components/lookPursuitModule/GazeHoldGame';
import { FamiliarFacesGame } from '@/components/familiarFacesModule/FamiliarFacesGame';
import {
  EyeIcon,
  AnalyticsIcon,
} from '@/components/icons/VectorIcons';
import {
  GameMode,
  AlphabetVariant,
  SortingVariant,
  GeoboardBoardId,
  GEOBOARD_BOARDS,
  GEOBOARD_BOARD_IDS,
  requestFullScreenSafe,
  UI_MODULE_TO_CATALOG,
  CATALOG_TO_UI_MODULE,
  MODULE_LEVELS,
  resolveAllowedModuleIds,
  GAME_FAMILIES,
  getGameFamily,
  familyForModuleId,
  isTherapyFamilyId,
  resolveBeePathType,
  resolvePursuitPattern,
  resolveLookPursuitPattern,
  resolveFamiliarFacesLevelId,
  resolvePeripheralField,
  directionSensePrescribedAllows,
  normalizeDirectionSenseLevelId,
  type PursuitMovementPattern,
  type PeripheralField,
} from '@candela/shared';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/layout/AppHeader';
import { PatientDashboardSkeleton } from '@/components/common/Skeleton';
import { MODULE_CARDS } from '@/lib/shell';

const VARIANT_TILE =
  'min-h-[140px] w-full rounded-2xl bg-white text-center flex justify-center items-center p-4 border-2 border-shell-border hover:border-shell-blue cursor-pointer transition-colors';

const EMPTY_LEVELS =
  'col-span-full bg-white rounded-3xl border border-shell-border p-10 text-center w-full';

type ActiveView = 'module' | 'family' | 'game' | 'analytics' | 'play_rotatory' | 'play_sorting' | 'play_bee_tracing' | 'play_pursuit' | 'play_mobile_target' | 'play_geoboard' | 'play_peripheral_view' | 'play_number_search' | 'play_pattern_match' | 'play_location_memory' | 'play_direction_sense' | 'play_computer_vision' | 'play_familiar_faces';

function MainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const allowedModuleIds = new Set(resolveAllowedModuleIds(session));
  const canPlayUiModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return Boolean(catalogId && allowedModuleIds.has(catalogId));
  };

  const isLevelAllowed = (uiId: string, levelId: string | number) => {
    if (!session || session.user.role !== 'patient') {
      return true;
    }
    if (!session.patient?.doctorId) {
      return true;
    }
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    if (!catalogId) {
      return false;
    }
    if (!allowedModuleIds.has(catalogId)) {
      return false;
    }
    const prescribedLevels = session.patient?.prescribedLevels?.[catalogId];
    if (prescribedLevels === undefined) {
      return true;
    }
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

  const [view, setView] = useState<ActiveView>('module');
  const [selectedTherapy, setSelectedTherapy] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);

  const [rotatoryConfig, setRotatoryConfig] = useState<{ mode: GameMode; variant: AlphabetVariant }>({
    mode: 'alphabets',
    variant: 'uppercase',
  });
  const [mobileTargetConfig, setMobileTargetConfig] = useState<{ mode: GameMode; variant: AlphabetVariant }>({
    mode: 'alphabets',
    variant: 'uppercase',
  });
  const [sortingVariant, setSortingVariant] = useState<SortingVariant>('uppercase');
  const [beePathType, setBeePathType] = useState<string>('straight');
  const [pursuitPattern, setPursuitPattern] = useState<PursuitMovementPattern>('linear_bounce');
  const [geoboardBoardId, setGeoboardBoardId] = useState<GeoboardBoardId>(1);
  const [peripheralField, setPeripheralField] = useState<PeripheralField>('both');
  const [patternMatchLevelId, setPatternMatchLevelId] = useState<string>('standard');
  const [locationMemoryLevelId, setLocationMemoryLevelId] = useState<string>('standard');
  const [directionSenseLevelId, setDirectionSenseLevelId] = useState<string>('face');
  const [computerVisionPattern, setComputerVisionPattern] = useState<PursuitMovementPattern>('stationary');
  const [familiarFacesLevelId, setFamiliarFacesLevelId] = useState('name_it');

  // Sync state from URL Query Params
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const familyParam = searchParams.get('family');
    const moduleParam = searchParams.get('module');
    const gameParam = searchParams.get('game');
    const modeParam = searchParams.get('mode') as GameMode | null;
    const variantParam = searchParams.get('variant') as AlphabetVariant | SortingVariant | null;
    const boardParam = searchParams.get('board');

    if (gameParam === 'rotatory' || (moduleParam === 'wheel' && modeParam)) {
      setRotatoryConfig({
        mode: modeParam || 'alphabets',
        variant: (variantParam as AlphabetVariant) || 'uppercase',
      });
      setSelectedTherapy('vision');
      setSelectedModule('wheel');
      setSelectedFamily(familyParam || 'spin_field');
      setView('play_rotatory');
    } else if (gameParam === 'sorting' || (moduleParam === 'sorting' && variantParam)) {
      setSortingVariant((variantParam as SortingVariant) || 'uppercase');
      setSelectedTherapy('vision');
      setSelectedModule('sorting');
      setSelectedFamily(familyParam || 'spin_field');
      setView('play_sorting');
    } else if (gameParam === 'bee_tracing') {
      setBeePathType(resolveBeePathType(variantParam));
      setSelectedTherapy('vision');
      setSelectedModule('tracing');
      setSelectedFamily(familyParam || 'trace_build');
      setView('play_bee_tracing');
    } else if (gameParam === 'pursuit') {
      if (variantParam) {
        setPursuitPattern(resolvePursuitPattern(variantParam));
        setSelectedTherapy('vision');
        setSelectedModule('pursuit');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('play_pursuit');
      } else {
        setSelectedTherapy('vision');
        setSelectedModule('pursuit');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('game');
      }
    } else if (gameParam === 'geoboard') {
      const parsed = Number(boardParam);
      const resolved = (GEOBOARD_BOARD_IDS as number[]).includes(parsed)
        ? (parsed as GeoboardBoardId)
        : 1;
      setGeoboardBoardId(resolved);
      setSelectedTherapy('vision');
      setSelectedModule('geoboard');
      setSelectedFamily(familyParam || 'trace_build');
      setView('play_geoboard');
    } else if (gameParam === 'peripheral_view' || gameParam === 'peripheral') {
      setPeripheralField(resolvePeripheralField(variantParam));
      setSelectedTherapy('vision');
      setSelectedModule('peripheral');
      setSelectedFamily(familyParam || 'look_jumps');
      setView('play_peripheral_view');
    } else if (gameParam === 'number_search') {
      setSelectedTherapy('vision');
      setSelectedModule('number_search');
      setSelectedFamily(familyParam || 'look_jumps');
      setView('play_number_search');
    } else if (gameParam === 'pattern_match') {
      const pmLevel = searchParams.get('variant');
      setPatternMatchLevelId(pmLevel === 'compound' ? 'compound' : 'standard');
      setSelectedTherapy('vision');
      setSelectedModule('pattern_match');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_pattern_match');
    } else if (gameParam === 'location_memory') {
      const lmLevel = searchParams.get('variant');
      setLocationMemoryLevelId(
        lmLevel === 'practice' ? 'practice' : lmLevel === 'match' ? 'match' : 'standard',
      );
      setSelectedTherapy('vision');
      setSelectedModule('location_memory');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_location_memory');
    } else if (gameParam === 'direction_sense') {
      const dsLevel = searchParams.get('variant');
      setDirectionSenseLevelId(normalizeDirectionSenseLevelId(dsLevel));
      setSelectedTherapy('vision');
      setSelectedModule('direction_sense');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_direction_sense');
    } else if (gameParam === 'computer_vision') {
      if (variantParam) {
        setComputerVisionPattern(resolveLookPursuitPattern(variantParam));
        setSelectedTherapy('vision');
        setSelectedModule('computer_vision');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('play_computer_vision');
      } else {
        setSelectedTherapy('vision');
        setSelectedModule('computer_vision');
        setSelectedFamily(familyParam || 'tap_timing');
        setView('game');
      }
    } else if (gameParam === 'familiar_faces') {
      setFamiliarFacesLevelId(resolveFamiliarFacesLevelId(searchParams.get('variant')));
      setSelectedTherapy('vision');
      setSelectedModule('familiar_faces');
      setSelectedFamily(familyParam || 'glimpse_hold');
      setView('play_familiar_faces');
    } else if (gameParam === 'mobile_target' || (moduleParam === 'mobile_target' && modeParam)) {
      setMobileTargetConfig({
        mode: modeParam || 'alphabets',
        variant: (variantParam as AlphabetVariant) || 'uppercase',
      });
      setSelectedTherapy('vision');
      setSelectedModule('mobile_target');
      setSelectedFamily(familyParam || 'tap_timing');
      setView('play_mobile_target');
    } else if (moduleParam) {
      const catalogId = UI_MODULE_TO_CATALOG[moduleParam];
      setSelectedTherapy('vision');
      setSelectedModule(moduleParam);
      setSelectedFamily(familyParam || familyForModuleId(catalogId ?? '')?.id || null);
      setView('game');
    } else if (familyParam && isTherapyFamilyId(familyParam)) {
      setSelectedTherapy('vision');
      setSelectedFamily(familyParam);
      setSelectedModule(null);
      setView('family');
    } else if (pageParam === 'analytics') {
      setSelectedTherapy('vision');
      setView('analytics');
    } else {
      setSelectedTherapy('vision');
      setSelectedModule(null);
      setSelectedFamily(null);
      setView('module');
    }
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!session) {
      router.replace('/');
      return;
    }
    if (session.user.role === 'admin') {
      router.replace('/admin');
      return;
    }
    if (session.user.role === 'doctor') {
      router.replace('/doctor');
    }
  }, [authLoading, session, router]);

  const updateQueryParams = (params: Record<string, string | null>) => {
    const newParams = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    const queryString = newParams.toString();
    router.push(queryString ? `/dashboard?${queryString}` : '/dashboard');
  };

  const familyQueryFor = (uiId: string) =>
    selectedFamily || familyForModuleId(UI_MODULE_TO_CATALOG[uiId] ?? '')?.id || null;

  const navigateToAnalytics = () => {
    updateQueryParams({
      page: 'analytics',
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleBackToModules = () => {
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: null,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleBackToFamily = () => {
    if (selectedFamily) {
      updateQueryParams({
        page: null,
        therapy: 'vision',
        family: selectedFamily,
        module: null,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
      return;
    }
    handleBackToModules();
  };

  const handleSelectFamily = (id: string) => {
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: id,
      module: null,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleSelectModule = (id: string) => {
    if (session?.user.role === 'patient' && !canPlayUiModule(id)) {
      return;
    }
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor(id),
      module: id,
      game: null,
      mode: null,
      variant: null,
      board: null,
    });
  };

  const handleLaunchRotatory = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('wheel'),
      module: 'wheel',
      game: 'rotatory',
      mode,
      variant,
    });
  };

  const handleLaunchBee = (pathType: string) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('tracing'),
      module: 'tracing',
      game: 'bee_tracing',
      mode: null,
      variant: pathType,
      board: null,
    });
  };

  const handleLaunchPursuit = (pattern: string) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('pursuit'),
      module: 'pursuit',
      game: 'pursuit',
      mode: null,
      variant: pattern,
      board: null,
    });
  };

  const handleLaunchSorting = (variant: SortingVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('sorting'),
      module: 'sorting',
      game: 'sorting',
      mode: null,
      variant,
    });
  };

  const handleLaunchMobileTarget = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('mobile_target'),
      module: 'mobile_target',
      game: 'mobile_target',
      mode,
      variant,
      board: null,
    });
  };

  const handleLaunchGeoboard = (boardId: GeoboardBoardId) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('geoboard'),
      module: 'geoboard',
      game: 'geoboard',
      mode: null,
      variant: null,
      board: String(boardId),
    });
  };

  const handleLaunchPeripheral = (field: PeripheralField) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('peripheral'),
      module: 'peripheral',
      game: 'peripheral_view',
      mode: null,
      variant: field,
      board: null,
    });
  };

  const handleLaunchNumberSearch = () => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('number_search'),
      module: 'number_search',
      game: 'number_search',
      mode: null,
      variant: 'standard',
      board: null,
    });
  };

  const handleLaunchPatternMatch = (levelId: string = 'standard') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('pattern_match'),
      module: 'pattern_match',
      game: 'pattern_match',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleLaunchLocationMemory = (levelId: string = 'standard') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('location_memory'),
      module: 'location_memory',
      game: 'location_memory',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleLaunchDirectionSense = (levelId: string = 'face') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('direction_sense'),
      module: 'direction_sense',
      game: 'direction_sense',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleLaunchComputerVision = (pattern: string = 'stationary') => {
    requestFullScreenSafe();
    const locked = resolveLookPursuitPattern(pattern);
    setComputerVisionPattern(locked);
    setSelectedTherapy('vision');
    setSelectedModule('computer_vision');
    setView('play_computer_vision');
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('computer_vision'),
      module: 'computer_vision',
      game: 'computer_vision',
      mode: null,
      variant: locked,
      board: null,
    });
  };

  const handleLaunchFamiliarFaces = (levelId: string = 'name_it') => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
      family: familyQueryFor('familiar_faces'),
      module: 'familiar_faces',
      game: 'familiar_faces',
      mode: null,
      variant: levelId,
      board: null,
    });
  };

  const handleExitGame = () => {
    if (selectedModule) {
      updateQueryParams({
        page: null,
        therapy: 'vision',
        family: familyQueryFor(selectedModule),
        module: selectedModule,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
    } else {
      handleBackToFamily();
    }
  };

  const isPlayingGame = view === 'play_rotatory' || view === 'play_sorting' || view === 'play_bee_tracing' || view === 'play_pursuit' || view === 'play_mobile_target' || view === 'play_geoboard' || view === 'play_peripheral_view' || view === 'play_number_search' || view === 'play_pattern_match' || view === 'play_location_memory' || view === 'play_direction_sense' || view === 'play_computer_vision' || view === 'play_familiar_faces';

  const visibleFamilies = GAME_FAMILIES.filter((family) =>
    family.moduleIds.some((catalogId) => canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId])),
  );
  const activeFamily = getGameFamily(selectedFamily);
  const familyActivityCards = (activeFamily?.moduleIds ?? [])
    .map((catalogId) => MODULE_CARDS.find((card) => card.uiId === CATALOG_TO_UI_MODULE[catalogId]))
    .filter((card): card is (typeof MODULE_CARDS)[number] => Boolean(card && canPlayUiModule(card.uiId)));

  if (authLoading || !session || session.user.role !== 'patient') {
    return (
      <div className="min-h-screen bg-page flex flex-col">
        <AppHeader />
        <PatientDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className={`w-screen ${isPlayingGame ? 'h-screen overflow-hidden' : 'min-h-screen overflow-y-auto flex flex-col'} bg-page relative select-none touch-manipulation`}>
      {!isPlayingGame && (
        <AppHeader
          onBack={
            view === 'game'
              ? handleBackToFamily
              : view === 'family' || view === 'analytics'
                ? handleBackToModules
                : undefined
          }
        />
      )}

      {/* FAMILY SELECTION VIEW */}
      {view === 'module' && (
        <>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-6 pb-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-extrabold text-shell-text tracking-tight">Vision Therapy</h2>
            <p className="text-[13px] text-shell-muted font-medium mt-0.5">Pick a family, then an activity</p>
          </div>
          <button
            onClick={navigateToAnalytics}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-shell-border text-shell-text font-semibold text-[13px] transition-all active:scale-95"
            title="View Session Analytics"
          >
            <AnalyticsIcon className="w-[18px] h-[18px] text-shell-blue" />
            <span className="hidden sm:inline">Analytics</span>
          </button>
        </div>
        <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
          {allowedModuleIds.size === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-3xl border border-shell-border p-7 text-center">
              <h3 className="text-lg font-bold text-shell-ink">No modules prescribed yet</h3>
              <p className="text-[13px] text-shell-muted mt-2">
                Your doctor has not added any therapy modules. Check back after they prescribe one.
              </p>
            </div>
          )}
          {visibleFamilies.map((family) => {
            const playableCount = family.moduleIds.filter((catalogId) =>
              canPlayUiModule(CATALOG_TO_UI_MODULE[catalogId]),
            ).length;
            return (
              <button
                key={family.id}
                type="button"
                onClick={() => handleSelectFamily(family.id)}
                className="relative overflow-hidden min-h-[160px] w-full rounded-[22px] bg-white text-left flex flex-col justify-between p-5 border border-shell-border cursor-pointer hover:border-shell-blue/40 transition-colors"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: family.bar }} />
                <div className="pt-2">
                  <h3 className="m-0 text-lg font-bold text-shell-ink">{family.title}</h3>
                  <p className="text-xs text-shell-muted mt-1.5 font-medium leading-relaxed">{family.body}</p>
                </div>
                <span
                  className="self-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                  style={{ color: family.accent, backgroundColor: `${family.accent}14` }}
                >
                  {playableCount} {playableCount === 1 ? 'activity' : 'activities'}
                </span>
              </button>
            );
          })}
        </main>
        </>
      )}

      {/* FAMILY ACTIVITIES VIEW */}
      {view === 'family' && activeFamily && (
        <>
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-6 pb-2">
          <h2 className="text-[22px] font-extrabold text-shell-text tracking-tight">{activeFamily.title}</h2>
          <p className="text-[13px] text-shell-muted font-medium mt-0.5">{activeFamily.body}</p>
        </div>
        <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
          {familyActivityCards.length === 0 && (
            <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-3xl border border-shell-border p-7 text-center">
              <h3 className="text-lg font-bold text-shell-ink">No activities prescribed yet</h3>
              <p className="text-[13px] text-shell-muted mt-2">
                Your doctor has not added any games in this family.
              </p>
            </div>
          )}
          {familyActivityCards.map((card) => (
            <button
              key={card.uiId}
              type="button"
              onClick={() => handleSelectModule(card.uiId)}
              className="relative overflow-hidden min-h-[160px] w-full rounded-[22px] bg-white text-left flex flex-col justify-between p-5 border border-shell-border cursor-pointer hover:border-shell-blue/40 transition-colors"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: card.bar }} />
              <div className="pt-2">
                <h3 className="m-0 text-lg font-bold text-shell-ink">{card.title}</h3>
                <p className="text-xs text-shell-muted mt-1.5 font-medium leading-relaxed">{card.body}</p>
              </div>
              <span
                className="self-center px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ color: card.accent, backgroundColor: `${card.accent}14` }}
              >
                {card.badge}
              </span>
            </button>
          ))}
        </main>
        </>
      )}

      {/* ANALYTICS PLACEHOLDER VIEW */}
      {view === 'analytics' && (
        <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-8 max-w-6xl mx-auto w-full">
          <div className="w-full flex items-center gap-3 mb-8 self-start">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-shell-blue flex items-center justify-center">
              <AnalyticsIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-[22px] font-extrabold text-shell-text tracking-tight">Session Analytics</h2>
              <p className="text-[13px] text-shell-muted font-medium">
                Review past session performance across all therapy modules
              </p>
            </div>
          </div>

          <div className="w-full flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-[88px] h-[88px] rounded-3xl bg-[#EFF6FF] text-blue-400 flex items-center justify-center mb-4">
              <AnalyticsIcon className="w-12 h-12" />
            </div>
            <h3 className="text-lg font-bold text-shell-ink mb-2">No Session Data Yet</h3>
            <p className="text-shell-muted text-[13px] max-w-md leading-relaxed mb-5">
              Complete therapy sessions to see your performance analytics here.
            </p>
            <button
              onClick={handleBackToModules}
              className="px-5 py-3 bg-shell-blue hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all active:scale-95 flex items-center gap-2"
            >
              <EyeIcon className="w-[18px] h-[18px]" />
              <span>Start a Therapy Session</span>
            </button>
          </div>
        </main>
      )}

      {/* GAME VARIANTS VIEW */}
      {view === 'game' && selectedModule && canPlayUiModule(selectedModule) && (
        <>
          <div className="max-w-6xl mx-auto w-full px-4 sm:px-8 pt-6 pb-2">
            {activeFamily && (
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: activeFamily.accent }}>
                {activeFamily.title}
              </p>
            )}
            <h2 className="text-[22px] font-extrabold text-shell-text tracking-tight">
              {selectedModule === 'wheel' && 'Rotatory Module'}
              {selectedModule === 'sorting' && 'Sorting Module'}
              {selectedModule === 'tracing' && 'Bee Path Tracing'}
              {selectedModule === 'pursuit' && 'Pursuit Module'}
              {selectedModule === 'mobile_target' && 'Bubble Chase'}
              {selectedModule === 'geoboard' && 'Draw a Pattern'}
              {selectedModule === 'peripheral' && 'Peripheral View'}
              {selectedModule === 'number_search' && 'Crowded Search'}
              {selectedModule === 'pattern_match' && 'Hold the Code'}
              {selectedModule === 'location_memory' && 'Location Memory'}
              {selectedModule === 'direction_sense' && 'Direction Sense'}
              {selectedModule === 'computer_vision' && 'Gaze Hold'}
              {selectedModule === 'familiar_faces' && 'Familiar Faces'}
            </h2>
            <p className="text-[13px] text-shell-muted font-medium mt-1">
              {selectedModule === 'wheel' && 'Select an exercise mode to begin'}
              {selectedModule === 'sorting' && 'Select a sorting category to begin'}
              {selectedModule === 'tracing' && 'Select a path type to begin'}
              {selectedModule === 'pursuit' && 'Select a movement pattern to begin'}
              {selectedModule === 'mobile_target' && 'Select an exercise mode to begin'}
              {selectedModule === 'geoboard' && 'Select a board to begin'}
              {selectedModule === 'peripheral' && 'Select a visual field · designed for landscape'}
              {selectedModule === 'number_search' && 'Find digits in a crowded letter field'}
              {selectedModule === 'pattern_match' && 'Hold a code — tap every exact match'}
              {selectedModule === 'location_memory' && 'Explore the grid, then find each number from memory'}
              {selectedModule === 'direction_sense' && 'See a letter and a rotate arrow — pick the matching 90° turn'}
              {selectedModule === 'computer_vision' && 'Look at the still bubble and hold your gaze to pop it'}
              {selectedModule === 'familiar_faces' && 'Add family photos, then name, find, or hold a face'}
            </p>
          </div>

          {selectedModule === 'wheel' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {isLevelAllowed('wheel', 'uppercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('alphabets', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Uppercase Rotatory</p>
                </button>
              )}
              {isLevelAllowed('wheel', 'lowercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('alphabets', 'lowercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Lowercase Rotatory</p>
                </button>
              )}
              {isLevelAllowed('wheel', 'numbers') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('numbers', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Numeric Rotatory</p>
                </button>
              )}
              {isLevelAllowed('wheel', 'colors') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchRotatory('colors', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Color Discriminant</p>
                </button>
              )}
              {!isLevelAllowed('wheel', 'uppercase') &&
                !isLevelAllowed('wheel', 'lowercase') &&
                !isLevelAllowed('wheel', 'numbers') &&
                !isLevelAllowed('wheel', 'colors') && (
                  <div className={EMPTY_LEVELS}>
                    <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                    <p className="text-[13px] text-shell-muted mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'sorting' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {isLevelAllowed('sorting', 'uppercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchSorting('uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Uppercase Alphabet Sorting</p>
                </button>
              )}
              {isLevelAllowed('sorting', 'lowercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchSorting('lowercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Lowercase Alphabet Sorting</p>
                </button>
              )}
              {isLevelAllowed('sorting', 'numbers') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchSorting('numbers')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Numeric Sorting</p>
                </button>
              )}
              {!isLevelAllowed('sorting', 'uppercase') &&
                !isLevelAllowed('sorting', 'lowercase') &&
                !isLevelAllowed('sorting', 'numbers') && (
                  <div className={EMPTY_LEVELS}>
                    <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                    <p className="text-[13px] text-shell-muted mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'tracing' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.bee_tracing.map((level) =>
                isLevelAllowed('tracing', level.id) ? (
                  <button type="button" key={level.id} className={VARIANT_TILE} onClick={() => handleLaunchBee(level.id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.bee_tracing.every((level) => !isLevelAllowed('tracing', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'pursuit' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.pursuit.map((level) =>
                isLevelAllowed('pursuit', level.id) ? (
                  <button type="button" key={level.id} className={VARIANT_TILE} onClick={() => handleLaunchPursuit(level.id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.pursuit.every((level) => !isLevelAllowed('pursuit', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'mobile_target' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {isLevelAllowed('mobile_target', 'uppercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('alphabets', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Uppercase Bubble Chase</p>
                </button>
              )}
              {isLevelAllowed('mobile_target', 'lowercase') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('alphabets', 'lowercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Lowercase Bubble Chase</p>
                </button>
              )}
              {isLevelAllowed('mobile_target', 'numbers') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('numbers', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Numeric Bubble Chase</p>
                </button>
              )}
              {isLevelAllowed('mobile_target', 'colors') && (
                <button type="button" className={VARIANT_TILE} onClick={() => handleLaunchMobileTarget('colors', 'uppercase')}>
                  <p className="m-0 text-lg font-semibold text-shell-ink">Color Discriminant Bubble Chase</p>
                </button>
              )}
              {!isLevelAllowed('mobile_target', 'uppercase') &&
                !isLevelAllowed('mobile_target', 'lowercase') &&
                !isLevelAllowed('mobile_target', 'numbers') &&
                !isLevelAllowed('mobile_target', 'colors') && (
                  <div className={EMPTY_LEVELS}>
                    <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                    <p className="text-[13px] text-shell-muted mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'geoboard' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).length === 0 ? (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No boards assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific boards for this module.
                  </p>
                </div>
              ) : (
                GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).map((id) => (
                  <button type="button" key={id} className={VARIANT_TILE} onClick={() => handleLaunchGeoboard(id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{GEOBOARD_BOARDS[id].shortLabel}</p>
                  </button>
                ))
              )}
            </main>
          )}

          {selectedModule === 'peripheral' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.peripheral_view.map((level) =>
                isLevelAllowed('peripheral', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchPeripheral(level.id as PeripheralField)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.peripheral_view.every((level) => !isLevelAllowed('peripheral', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'number_search' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.number_search.map((level) =>
                isLevelAllowed('number_search', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={handleLaunchNumberSearch}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.number_search.every((level) => !isLevelAllowed('number_search', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'pattern_match' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.pattern_match.map((level) =>
                isLevelAllowed('pattern_match', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchPatternMatch(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.pattern_match.every((level) => !isLevelAllowed('pattern_match', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'location_memory' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.location_memory.map((level) =>
                isLevelAllowed('location_memory', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchLocationMemory(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.location_memory.every((level) => !isLevelAllowed('location_memory', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'direction_sense' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.direction_sense.map((level) =>
                isLevelAllowed('direction_sense', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchDirectionSense(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.direction_sense.every((level) => !isLevelAllowed('direction_sense', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'computer_vision' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.computer_vision.map((level) =>
                isLevelAllowed('computer_vision', level.id) ? (
                  <button type="button" key={level.id} className={VARIANT_TILE} onClick={() => handleLaunchComputerVision(level.id)}>
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.computer_vision.every((level) => !isLevelAllowed('computer_vision', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'familiar_faces' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4 sm:px-8 py-4 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.familiar_faces.map((level) =>
                isLevelAllowed('familiar_faces', level.id) ? (
                  <button
                    type="button"
                    key={level.id}
                    className={VARIANT_TILE}
                    onClick={() => handleLaunchFamiliarFaces(level.id)}
                  >
                    <p className="m-0 text-lg font-semibold text-shell-ink">{level.name}</p>
                  </button>
                ) : null,
              )}
              {MODULE_LEVELS.familiar_faces.every((level) => !isLevelAllowed('familiar_faces', level.id)) && (
                <div className={EMPTY_LEVELS}>
                  <h3 className="text-lg font-bold text-shell-ink">No levels assigned yet</h3>
                  <p className="text-[13px] text-shell-muted mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}
        </>
      )}

      {/* GAME LAUNCHERS */}
      {view === 'play_rotatory' && canPlayUiModule('wheel') && isLevelAllowed('wheel', rotatoryConfig.mode === 'alphabets' ? rotatoryConfig.variant : rotatoryConfig.mode) && (
        <RotatoryWheelGame
          initialMode={rotatoryConfig.mode}
          initialVariant={rotatoryConfig.variant}
          onExit={handleExitGame}
        />
      )}

      {view === 'play_sorting' && canPlayUiModule('sorting') && isLevelAllowed('sorting', sortingVariant) && (
        <SortingGame variant={sortingVariant} onExit={handleExitGame} />
      )}

      {view === 'play_bee_tracing' && canPlayUiModule('tracing') && isLevelAllowed('tracing', beePathType) && (
        <BeeTracingGame initialPathType={beePathType} onExit={handleExitGame} />
      )}

      {view === 'play_pursuit' && canPlayUiModule('pursuit') && isLevelAllowed('pursuit', pursuitPattern) && (
        <PursuitGame initialMovementPattern={pursuitPattern} onExit={handleExitGame} />
      )}

      {view === 'play_mobile_target' && canPlayUiModule('mobile_target') && isLevelAllowed('mobile_target', mobileTargetConfig.mode === 'alphabets' ? mobileTargetConfig.variant : mobileTargetConfig.mode) && (
        <MobileTargetGame
          initialMode={mobileTargetConfig.mode}
          initialVariant={mobileTargetConfig.variant}
          onExit={handleExitGame}
        />
      )}

      {view === 'play_geoboard' && canPlayUiModule('geoboard') && isLevelAllowed('geoboard', geoboardBoardId) && (
        <GeoboardGame boardId={geoboardBoardId} onExit={handleExitGame} />
      )}

      {view === 'play_peripheral_view' && canPlayUiModule('peripheral') && isLevelAllowed('peripheral', peripheralField) && (
        <PeripheralViewGame field={peripheralField} onExit={handleExitGame} />
      )}

      {view === 'play_number_search' && canPlayUiModule('number_search') && isLevelAllowed('number_search', 'standard') && (
        <NumberSearchGame onExit={handleExitGame} />
      )}

      {view === 'play_pattern_match' &&
        canPlayUiModule('pattern_match') &&
        isLevelAllowed('pattern_match', patternMatchLevelId) && (
          <PatternMatchGame levelId={patternMatchLevelId} onExit={handleExitGame} />
        )}

      {view === 'play_location_memory' &&
        canPlayUiModule('location_memory') &&
        isLevelAllowed('location_memory', locationMemoryLevelId) && (
          <LocationMemoryGame levelId={locationMemoryLevelId} onExit={handleExitGame} />
        )}

      {view === 'play_direction_sense' &&
        canPlayUiModule('direction_sense') &&
        isLevelAllowed('direction_sense', directionSenseLevelId) && (
          <DirectionSenseGame levelId={directionSenseLevelId} onExit={handleExitGame} />
        )}

      {view === 'play_computer_vision' &&
        canPlayUiModule('computer_vision') &&
        isLevelAllowed('computer_vision', computerVisionPattern) && (
          <GazeHoldGame onExit={handleExitGame} />
        )}

      {view === 'play_familiar_faces' &&
        canPlayUiModule('familiar_faces') &&
        isLevelAllowed('familiar_faces', familiarFacesLevelId) && (
          <FamiliarFacesGame levelId={familiarFacesLevelId} onExit={handleExitGame} />
        )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg font-semibold">Loading Kandela...</div>}>
      <MainContent />
    </Suspense>
  );
}
