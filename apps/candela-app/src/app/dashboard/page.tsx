'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotatoryWheelGame } from '@/components/rotatoryModule/RotatoryWheelGame';
import { SortingGame } from '@/components/sortingModule/SortingGame';
import { BeeTracingGame } from '@/components/beeTrackingModule/BeeTracingGame';
import { PursuitGame } from '@/components/pursuitModule/PursuitGame';
import { MobileTargetGame } from '@/components/mobileTargetModule/MobileTargetGame';
import { GeoboardGame } from '@/components/geoboardModule/GeoboardGame';
import {
  EyeIcon,
  AnalyticsIcon,
  ArrowLeftIcon,
} from '@/components/icons/VectorIcons';
import {
  GameMode,
  AlphabetVariant,
  SortingVariant,
  GeoboardBoardId,
  GEOBOARD_BOARDS,
  GEOBOARD_BOARD_IDS,
  getBoardPatterns,
  requestFullScreenSafe,
  UI_MODULE_TO_CATALOG,
  MODULE_LEVELS,
  resolveBeePathType,
  resolvePursuitPattern,
  type PursuitMovementPattern,
} from '@candela/shared';
import { useAuth } from '@/lib/auth-context';
import { AppHeader } from '@/components/layout/AppHeader';
import { PatientDashboardSkeleton } from '@/components/common/Skeleton';

type ActiveView = 'module' | 'game' | 'analytics' | 'play_rotatory' | 'play_sorting' | 'play_bee_tracing' | 'play_pursuit' | 'play_mobile_target' | 'play_geoboard';

function MainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const allowedModuleIds = new Set(session?.allowedModuleIds ?? []);
  const canPlayUiModule = (uiId: string) => {
    const catalogId = UI_MODULE_TO_CATALOG[uiId];
    return Boolean(catalogId && allowedModuleIds.has(catalogId));
  };

  const isLevelAllowed = (uiId: string, levelId: string | number) => {
    if (!session || session.user.role !== 'patient') {
      return true;
    }
    if (session.patient?.origin === 'self_signup' || !session.patient?.doctorId) {
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
    return prescribedLevels.includes(String(levelId));
  };

  const [view, setView] = useState<ActiveView>('module');
  const [selectedTherapy, setSelectedTherapy] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

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

  // Sync state from URL Query Params
  useEffect(() => {
    const pageParam = searchParams.get('page');
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
      setView('play_rotatory');
    } else if (gameParam === 'sorting' || (moduleParam === 'sorting' && variantParam)) {
      setSortingVariant((variantParam as SortingVariant) || 'uppercase');
      setSelectedTherapy('vision');
      setSelectedModule('sorting');
      setView('play_sorting');
    } else if (gameParam === 'bee_tracing') {
      setBeePathType(resolveBeePathType(variantParam));
      setSelectedTherapy('vision');
      setSelectedModule('tracing');
      setView('play_bee_tracing');
    } else if (gameParam === 'pursuit') {
      if (variantParam) {
        setPursuitPattern(resolvePursuitPattern(variantParam));
        setSelectedTherapy('vision');
        setSelectedModule('pursuit');
        setView('play_pursuit');
      } else {
        setSelectedTherapy('vision');
        setSelectedModule('pursuit');
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
      setView('play_geoboard');
    } else if (gameParam === 'mobile_target' || (moduleParam === 'mobile_target' && modeParam)) {
      setMobileTargetConfig({
        mode: modeParam || 'alphabets',
        variant: (variantParam as AlphabetVariant) || 'uppercase',
      });
      setSelectedTherapy('vision');
      setSelectedModule('mobile_target');
      setView('play_mobile_target');
    } else if (moduleParam) {
      setSelectedTherapy('vision');
      setSelectedModule(moduleParam);
      setView('game');
    } else if (pageParam === 'analytics') {
      setSelectedTherapy('vision');
      setView('analytics');
    } else {
      setSelectedTherapy('vision');
      setSelectedModule(null);
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

  const navigateToAnalytics = () => {
    updateQueryParams({ page: 'analytics', therapy: 'vision', module: null, game: null, mode: null, variant: null, board: null });
  };

  const handleBackToModules = () => {
    updateQueryParams({
      page: null,
      therapy: 'vision',
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
    updateQueryParams({ page: null, therapy: 'vision', module: id, game: null, mode: null, variant: null, board: null });
  };

  const handleLaunchRotatory = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: null,
      therapy: 'vision',
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
      module: 'geoboard',
      game: 'geoboard',
      mode: null,
      variant: null,
      board: String(boardId),
    });
  };

  const handleExitGame = () => {
    if (selectedModule) {
      updateQueryParams({
        page: null,
        therapy: 'vision',
        module: selectedModule,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
    } else {
      updateQueryParams({
        page: null,
        therapy: 'vision',
        module: null,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
    }
  };

  const isPlayingGame = view === 'play_rotatory' || view === 'play_sorting' || view === 'play_bee_tracing' || view === 'play_pursuit' || view === 'play_mobile_target' || view === 'play_geoboard';

  if (authLoading || !session || session.user.role !== 'patient') {
    return (
      <div className="min-h-screen bg-[#F4F7FC] flex flex-col">
        <AppHeader />
        <PatientDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className={`w-screen ${isPlayingGame ? 'h-screen overflow-hidden' : 'min-h-screen overflow-y-auto flex flex-col'} bg-[#F4F7FC] relative select-none touch-manipulation`}>
      {!isPlayingGame && (
        <>
          <div className="fixed top-[-10vw] left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="fixed bottom-[-10vw] right-1/4 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none z-0" />
        </>
      )}
      {!isPlayingGame && (
        <AppHeader
          onBack={view === 'game' || view === 'analytics' ? handleBackToModules : undefined}
        />
      )}

      {/* MODULE SELECTION VIEW */}
      {view === 'module' && (
        <>
        {/* MODULE HEADER WITH ANALYTICS ICON */}
        <div className="max-w-6xl mx-auto w-full px-8 pt-8 pb-2 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Vision Therapy</h2>
            <p className="text-sm text-gray-500 font-medium mt-0.5">Select a therapy module to begin</p>
          </div>
          <button
            onClick={navigateToAnalytics}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 text-gray-700 hover:text-blue-600 font-semibold text-sm transition-all active:scale-95 group"
            title="View Session Analytics"
          >
            <AnalyticsIcon className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="hidden sm:inline">Analytics</span>
          </button>
        </div>
        <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
          {allowedModuleIds.size === 0 && (
            <div className="sm:col-span-2 lg:col-span-4 bg-white rounded-3xl border border-gray-100 p-10 text-center">
              <h3 className="text-xl font-bold text-gray-800">No modules prescribed yet</h3>
              <p className="text-sm text-gray-500 mt-2">
                Your doctor has not added any therapy modules. Check back after they prescribe one.
              </p>
            </div>
          )}
          {/* Rotatory Module */}
          {canPlayUiModule('wheel') && (
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-blue-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-blue-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('wheel')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors">
                Rotatory Module
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                Dynamic wheel tracking & visual pursuit exercises
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors shadow-2xs">
              For Tabs
            </span>
          </div>
          )}

          {/* Sorting Module */}
          {canPlayUiModule('sorting') && (
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-purple-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-purple-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('sorting')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-purple-600 transition-colors">
                Sorting Module
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                Visual discrimination & sequential recognition
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-600 transition-colors shadow-2xs">
              For Tabs & Mobile
            </span>
          </div>
          )}

          {/* Bee Path Tracing */}
          {canPlayUiModule('tracing') && (
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-amber-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-amber-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('tracing')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-orange-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-amber-600 transition-colors">
                Bee Path Tracing
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                Smooth pursuit tracking & visual-motor path control
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 group-hover:bg-amber-600 group-hover:text-white group-hover:border-amber-600 transition-colors shadow-2xs">
              For Touch & Stylus
            </span>
          </div>
          )}

          {/* Pursuit Module */}
          {canPlayUiModule('pursuit') && (
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-cyan-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-cyan-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('pursuit')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-cyan-600 transition-colors">
                Pursuit Module
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                Continuous visual pursuit & selective attention tracking
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/80 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-600 transition-colors shadow-2xs">
              For All Devices
            </span>
          </div>
          )}

          {/* Bubble Chase */}
          {canPlayUiModule('mobile_target') && (
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-emerald-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-emerald-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('mobile_target')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-emerald-600 transition-colors">
                Bubble Chase
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                2-target bouncing pursuit & dark field tracking
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-colors shadow-2xs">
              For Mobile & Tabs
            </span>
          </div>
          )}

          {canPlayUiModule('geoboard') && (
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-teal-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-teal-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('geoboard')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-400 to-emerald-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-teal-600 transition-colors">
                Draw a Pattern
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                Hand-eye coordination & visual spatial recall patterns
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/80 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-colors shadow-2xs">
              For All Devices
            </span>
          </div>
          )}
        </main>
        </>
      )}

      {/* ANALYTICS PLACEHOLDER VIEW */}
      {view === 'analytics' && (
        <main className="flex-1 flex flex-col items-center px-6 py-10 max-w-6xl mx-auto w-full">
          {/* Analytics Header */}
          <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <AnalyticsIcon className="w-6 h-6" />
                </div>
                Session Analytics
              </h2>
              <p className="text-sm text-gray-500 font-medium mt-1 ml-[52px]">
                Review past session performance across all therapy modules
              </p>
            </div>
          </div>

          {/* Placeholder Empty State */}
          <div className="w-full flex-1 flex flex-col items-center justify-center text-center py-20">
            <div className="w-24 h-24 rounded-3xl bg-blue-50 text-blue-400 flex items-center justify-center mb-6">
              <AnalyticsIcon className="w-14 h-14" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              No Session Data Yet
            </h3>
            <p className="text-gray-500 text-sm max-w-md leading-relaxed mb-8">
              Complete therapy sessions to see your performance analytics here. Session results including accuracy, reaction times, and progress tracking will appear on this page.
            </p>
            <button
              onClick={() => updateQueryParams({ page: null, therapy: 'vision', module: null, game: null, mode: null, variant: null, board: null })}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-2"
            >
              <EyeIcon className="w-5 h-5" />
              <span>Start a Therapy Session</span>
            </button>
          </div>
        </main>
      )}

      {/* GAME VARIANTS VIEW */}
      {view === 'game' && selectedModule && canPlayUiModule(selectedModule) && (
        <>
          <div className="max-w-6xl mx-auto w-full px-8 pt-8 pb-2">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {selectedModule === 'wheel' && 'Rotatory Module'}
              {selectedModule === 'sorting' && 'Sorting Module'}
              {selectedModule === 'tracing' && 'Bee Path Tracing'}
              {selectedModule === 'pursuit' && 'Pursuit Module'}
              {selectedModule === 'mobile_target' && 'Bubble Chase'}
              {selectedModule === 'geoboard' && 'Draw a Pattern'}
            </h2>
            <p className="text-sm text-gray-500 font-medium mt-1">
              {selectedModule === 'wheel' && 'Select an exercise mode to begin'}
              {selectedModule === 'sorting' && 'Select a sorting category to begin'}
              {selectedModule === 'tracing' && 'Select a path geometry to begin'}
              {selectedModule === 'pursuit' && 'Select a movement pattern to begin'}
              {selectedModule === 'mobile_target' && 'Select an exercise mode to begin'}
              {selectedModule === 'geoboard' && 'Select a board. Every pattern in the board runs in order, then the session report opens.'}
            </p>
          </div>

          {selectedModule === 'wheel' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
              {isLevelAllowed('wheel', 'uppercase') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchRotatory('alphabets', 'uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Rotatory</p>
                </div>
              )}
              {isLevelAllowed('wheel', 'lowercase') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchRotatory('alphabets', 'lowercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Rotatory</p>
                </div>
              )}
              {isLevelAllowed('wheel', 'numbers') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchRotatory('numbers', 'uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Rotatory</p>
                </div>
              )}
              {isLevelAllowed('wheel', 'colors') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchRotatory('colors', 'uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Color Discriminant</p>
                </div>
              )}
              {!isLevelAllowed('wheel', 'uppercase') &&
                !isLevelAllowed('wheel', 'lowercase') &&
                !isLevelAllowed('wheel', 'numbers') &&
                !isLevelAllowed('wheel', 'colors') && (
                  <div className="col-span-full bg-white rounded-3xl border border-gray-100 p-10 text-center w-full">
                    <h3 className="text-xl font-bold text-gray-800">No levels assigned yet</h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'sorting' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
              {isLevelAllowed('sorting', 'uppercase') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchSorting('uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Alphabet Sorting</p>
                </div>
              )}
              {isLevelAllowed('sorting', 'lowercase') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchSorting('lowercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Alphabet Sorting</p>
                </div>
              )}
              {isLevelAllowed('sorting', 'numbers') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchSorting('numbers')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Sorting</p>
                </div>
              )}
              {!isLevelAllowed('sorting', 'uppercase') &&
                !isLevelAllowed('sorting', 'lowercase') &&
                !isLevelAllowed('sorting', 'numbers') && (
                  <div className="col-span-full bg-white rounded-3xl border border-gray-100 p-10 text-center w-full">
                    <h3 className="text-xl font-bold text-gray-800">No levels assigned yet</h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'tracing' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.bee_tracing.map((level) =>
                isLevelAllowed('tracing', level.id) ? (
                  <div
                    key={level.id}
                    className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-amber-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                    onClick={() => handleLaunchBee(level.id)}
                  >
                    <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">{level.name}</p>
                  </div>
                ) : null,
              )}
              {MODULE_LEVELS.bee_tracing.every((level) => !isLevelAllowed('tracing', level.id)) && (
                <div className="col-span-full bg-white rounded-3xl border border-gray-100 p-10 text-center w-full">
                  <h3 className="text-xl font-bold text-gray-800">No levels assigned yet</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'pursuit' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
              {MODULE_LEVELS.pursuit.map((level) =>
                isLevelAllowed('pursuit', level.id) ? (
                  <div
                    key={level.id}
                    className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-cyan-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                    onClick={() => handleLaunchPursuit(level.id)}
                  >
                    <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">{level.name}</p>
                  </div>
                ) : null,
              )}
              {MODULE_LEVELS.pursuit.every((level) => !isLevelAllowed('pursuit', level.id)) && (
                <div className="col-span-full bg-white rounded-3xl border border-gray-100 p-10 text-center w-full">
                  <h3 className="text-xl font-bold text-gray-800">No levels assigned yet</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Your doctor has not enabled any specific levels for this module.
                  </p>
                </div>
              )}
            </main>
          )}

          {selectedModule === 'mobile_target' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
              {isLevelAllowed('mobile_target', 'uppercase') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchMobileTarget('alphabets', 'uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Bubble Chase</p>
                </div>
              )}
              {isLevelAllowed('mobile_target', 'lowercase') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchMobileTarget('alphabets', 'lowercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Bubble Chase</p>
                </div>
              )}
              {isLevelAllowed('mobile_target', 'numbers') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchMobileTarget('numbers', 'uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Bubble Chase</p>
                </div>
              )}
              {isLevelAllowed('mobile_target', 'colors') && (
                <div
                  className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
                  onClick={() => handleLaunchMobileTarget('colors', 'uppercase')}
                >
                  <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Color Discriminant Bubble Chase</p>
                </div>
              )}
              {!isLevelAllowed('mobile_target', 'uppercase') &&
                !isLevelAllowed('mobile_target', 'lowercase') &&
                !isLevelAllowed('mobile_target', 'numbers') &&
                !isLevelAllowed('mobile_target', 'colors') && (
                  <div className="col-span-full bg-white rounded-3xl border border-gray-100 p-10 text-center w-full">
                    <h3 className="text-xl font-bold text-gray-800">No levels assigned yet</h3>
                    <p className="text-sm text-gray-500 mt-2">
                      Your doctor has not enabled any specific levels for this module.
                    </p>
                  </div>
                )}
            </main>
          )}

          {selectedModule === 'geoboard' && (
            <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
              {GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).length === 0 ? (
                <div className="col-span-full bg-white rounded-3xl border border-gray-100 p-10 text-center w-full">
                  <h3 className="text-xl font-bold text-gray-800">No boards assigned yet</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    Your doctor has not enabled any specific boards for this module.
                  </p>
                </div>
              ) : (
                GEOBOARD_BOARD_IDS.filter((id) => isLevelAllowed('geoboard', id)).map((id) => {
                  const board = GEOBOARD_BOARDS[id];
                  const patternCount = getBoardPatterns(id).length;

                  return (
                    <div
                      key={id}
                      className="relative overflow-hidden min-h-[190px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-teal-500/20 flex flex-col justify-between p-6 border border-gray-100 hover:border-teal-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
                      onClick={() => handleLaunchGeoboard(id)}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-400 to-emerald-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
                      <div className="pt-1">
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200/80 flex items-center justify-center font-black text-sm shrink-0 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-colors">
                            {String(id).padStart(2, '0')}
                          </span>
                          <h3 className="m-0 text-[19px] font-bold text-[#1A1A1A] group-hover:text-teal-600 transition-colors">
                            {board.shortLabel}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">
                          {board.description}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                          {board.focus}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/80 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-colors shadow-2xs">
                          {patternCount} patterns
                        </span>
                        {board.supportsLetterCase && (
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            Aa toggle
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
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
