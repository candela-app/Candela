'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotatoryWheelGame } from '@/components/rotatoryModule/RotatoryWheelGame';
import { SortingGame } from '@/components/sortingModule/SortingGame';
import { BeeTracingGame } from '@/components/beeTrackingModule/BeeTracingGame';
import { PursuitGame } from '@/components/pursuitModule/PursuitGame';
import { MobileTargetGame } from '@/components/mobileTargetModule/MobileTargetGame';
import { GeoboardGame } from '@/components/geoboardModule/GeoboardGame';
import { HomePageContent } from '@/components/home/HomePageContent';
import {
  EyeIcon,
  RotatoryIcon,
  PuzzleIcon,
  BeePathIcon,
  TargetIcon,
  MobileTargetIcon,
  GeoboardIcon,
  HomeIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  AnalyticsIcon,
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
} from '@candela/shared';

type ActiveView = 'home' | 'dashboard' | 'module' | 'game' | 'analytics' | 'play_rotatory' | 'play_sorting' | 'play_bee_tracing' | 'play_pursuit' | 'play_mobile_target' | 'play_geoboard';

function MainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ActiveView>('home');
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
  const [geoboardBoardId, setGeoboardBoardId] = useState<GeoboardBoardId>(1);

  // Sync state from URL Query Params
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const therapy = searchParams.get('therapy');
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
      setSelectedTherapy('vision');
      setSelectedModule('tracing');
      setView('play_bee_tracing');
    } else if (gameParam === 'pursuit') {
      setSelectedTherapy('vision');
      setSelectedModule('pursuit');
      setView('play_pursuit');
    } else if (gameParam === 'mobile_target' || (moduleParam === 'mobile_target' && modeParam)) {
      setMobileTargetConfig({
        mode: modeParam || 'alphabets',
        variant: (variantParam as AlphabetVariant) || 'uppercase',
      });
      setSelectedTherapy('vision');
      setSelectedModule('mobile_target');
      setView('play_mobile_target');
    } else if (gameParam === 'geoboard') {
      const parsed = Number(boardParam);
      const resolved = (GEOBOARD_BOARD_IDS as number[]).includes(parsed)
        ? (parsed as GeoboardBoardId)
        : 1;
      setGeoboardBoardId(resolved);
      setSelectedTherapy('vision');
      setSelectedModule('geoboard');
      setView('play_geoboard');
    } else if (moduleParam) {
      setSelectedTherapy('vision');
      setSelectedModule(moduleParam);
      setView('game');
    } else if (pageParam === 'analytics') {
      setSelectedTherapy('vision');
      setView('analytics');
    } else if (therapy) {
      setSelectedTherapy(therapy);
      setView('module');
    } else if (pageParam === 'dashboard') {
      setSelectedTherapy(null);
      setSelectedModule(null);
      setView('dashboard');
    } else {
      setSelectedTherapy(null);
      setSelectedModule(null);
      setView('home');
    }
  }, [searchParams]);

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
    router.push(queryString ? `/?${queryString}` : '/');
  };

  const navigateToHome = () => {
    updateQueryParams({ page: null, therapy: null, module: null, game: null, mode: null, variant: null, board: null });
  };

  const navigateToDashboard = () => {
    updateQueryParams({ page: 'dashboard', therapy: null, module: null, game: null, mode: null, variant: null, board: null });
  };

  const handleGoBack = () => {
    if (view === 'game') {
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: null, game: null, mode: null, variant: null, board: null });
    } else if (view === 'analytics') {
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: null, game: null, mode: null, variant: null, board: null });
    } else if (view === 'module') {
      updateQueryParams({ page: 'dashboard', therapy: null, module: null, game: null, mode: null, variant: null, board: null });
    } else if (view === 'dashboard') {
      navigateToHome();
    } else {
      navigateToHome();
    }
  };

  const navigateToAnalytics = () => {
    updateQueryParams({ page: 'analytics', therapy: 'vision', module: null, game: null, mode: null, variant: null, board: null });
  };

  const handleSelectTherapy = (id: string) => {
    updateQueryParams({ page: 'dashboard', therapy: id, module: null, game: null, mode: null, variant: null, board: null });
  };

  const handleSelectModule = (id: string) => {
    if (id === 'tracing') {
      requestFullScreenSafe();
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: 'tracing', game: 'bee_tracing', mode: null, variant: null, board: null });
    } else if (id === 'pursuit') {
      requestFullScreenSafe();
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: 'pursuit', game: 'pursuit', mode: null, variant: null, board: null });
    } else if (id === 'geoboard') {
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: 'geoboard', game: null, mode: null, variant: null, board: null });
    } else {
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: id, game: null, mode: null, variant: null, board: null });
    }
  };

  const handleLaunchRotatory = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: 'dashboard',
      therapy: 'vision',
      module: 'wheel',
      game: 'rotatory',
      mode,
      variant,
    });
  };

  const handleLaunchSorting = (variant: SortingVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: 'dashboard',
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
      page: 'dashboard',
      therapy: 'vision',
      module: 'mobile_target',
      game: 'mobile_target',
      mode,
      variant,
    });
  };

  const handleLaunchGeoboard = (boardId: GeoboardBoardId) => {
    requestFullScreenSafe();
    updateQueryParams({
      page: 'dashboard',
      therapy: 'vision',
      module: 'geoboard',
      game: 'geoboard',
      mode: null,
      variant: null,
      board: String(boardId),
    });
  };

  const handleExitGame = () => {
    if (selectedModule && selectedModule !== 'pursuit' && selectedModule !== 'tracing') {
      updateQueryParams({
        page: 'dashboard',
        therapy: 'vision',
        module: selectedModule,
        game: null,
        mode: null,
        variant: null,
        board: null,
      });
    } else {
      updateQueryParams({
        page: 'dashboard',
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

  return (
    <div className={`w-screen ${isPlayingGame ? 'h-screen overflow-hidden' : 'min-h-screen overflow-y-auto flex flex-col'} bg-[#F4F7FC] relative select-none touch-manipulation`}>
      {/* AMBIENT BACKGROUND GLOW ACCENTS */}
      {!isPlayingGame && (
        <>
          <div className="fixed top-[-10vw] left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none z-0" />
          <div className="fixed bottom-[-10vw] right-1/4 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[120px] pointer-events-none z-0" />
        </>
      )}
      {/* HEADER NAVBAR SECTION */}
      {!isPlayingGame && (
        <header className="sticky top-0 z-50 flex flex-row items-center justify-between px-6 pt-2 pb-3 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 gap-4">
          {/* LEFT: BRAND LOGO */}
          <button
            type="button"
            onClick={navigateToHome}
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity bg-transparent border-0 p-0"
            aria-label="Kandela home"
          >
            <img
              src="/updated_Web%20logo.png"
              alt="Kandela"
              className="block h-12 w-auto"
            />
          </button>

          {/* RIGHT: BACK BUTTON & HOME / DASHBOARD CONTEXT BUTTON */}
          <div className="flex items-center gap-3 mt-3.5">
            {/* Back button (only shown when inside dashboard / sub-views) */}
            {view !== 'home' && (
              <button
                onClick={handleGoBack}
                className="px-3.5 py-1.5 rounded-xl bg-gray-100/90 hover:bg-gray-200/80 text-gray-700 text-sm font-semibold transition-all flex items-center gap-1.5 border border-gray-200/60 shadow-2xs active:scale-95"
              >
                <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
                <span>Back</span>
              </button>
            )}

            {/* Context-aware Home / Dashboard button */}
            {view === 'home' ? (
              <button
                onClick={navigateToDashboard}
                className="h-8 px-4 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-2 border border-blue-600 shadow-sm active:scale-95"
              >
                <span>Dashboard</span>
                <ArrowRightIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={navigateToHome}
                className="p-2.5 rounded-xl bg-blue-50/90 hover:bg-blue-100/90 text-blue-600 hover:text-blue-700 transition-all border border-blue-200/80 shadow-xs hover:shadow-sm active:scale-95 flex items-center justify-center"
                title="Return to Landing Page"
              >
                <HomeIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>
      )}

      {/* HOME PAGE VIEW */}
      {view === 'home' && (
        <HomePageContent
          onOpenDashboard={navigateToDashboard}
          onSelectModule={handleSelectModule}
        />
      )}

      {/* DASHBOARD VIEW - THERAPY SELECTION */}
      {view === 'dashboard' && (
        <main className="flex-1 grid items-center justify-items-center grid-cols-1 gap-6 p-8 my-auto max-w-5xl mx-auto w-full">
          <div
            className="h-[160px] w-full max-w-[400px] rounded-[24px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-8 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectTherapy('vision')}
          >
            <h3 className="m-0 text-[28px] font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors">
              Vision Therapy
            </h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">
              Click to open Vision Therapy Games & Modules
            </p>
          </div>
        </main>
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
          {/* Rotatory Module */}
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

          {/* Sorting Module */}
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

          {/* Bee Path Tracing */}
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

          {/* Pursuit Module */}
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

          {/* Bubble Chase */}
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

          {/* Geoboard Module */}
          <div
            className="relative overflow-hidden h-[175px] w-full rounded-[22px] bg-white shadow-sm hover:shadow-xl hover:shadow-teal-500/20 text-center flex flex-col justify-between items-center p-6 border border-gray-100 hover:border-teal-300/80 cursor-pointer transform hover:-translate-y-1.5 transition-all duration-300 group"
            onClick={() => handleSelectModule('geoboard')}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-400 to-emerald-500 opacity-70 group-hover:opacity-100 group-hover:h-2 transition-all duration-300" />
            <div className="pt-1">
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-teal-600 transition-colors">
                Geoboard Module
              </h3>
              <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                Hand-eye coordination & visual spatial recall patterns
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200/80 group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600 transition-colors shadow-2xs">
              For All Devices
            </span>
          </div>
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
              onClick={() => updateQueryParams({ page: 'dashboard', therapy: 'vision', module: null, game: null, mode: null, variant: null, board: null })}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center gap-2"
            >
              <EyeIcon className="w-5 h-5" />
              <span>Start a Therapy Session</span>
            </button>
          </div>
        </main>
      )}

      {/* GAME VARIANTS VIEW */}
      {view === 'game' && selectedModule === 'wheel' && (
        <main className="flex-1 grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 my-auto max-w-6xl mx-auto w-full">
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('alphabets', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Rotatory</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('alphabets', 'lowercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Rotatory</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('numbers', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Rotatory</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('colors', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Color Discriminant</p>
          </div>
        </main>
      )}

      {view === 'game' && selectedModule === 'sorting' && (
        <main className="flex-1 grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 my-auto max-w-6xl mx-auto w-full">
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchSorting('uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Alphabet Sorting</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchSorting('lowercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Alphabet Sorting</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchSorting('numbers')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Sorting</p>
          </div>
        </main>
      )}

      {view === 'game' && selectedModule === 'mobile_target' && (
        <main className="flex-1 grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 my-auto max-w-6xl mx-auto w-full">
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('alphabets', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Bubble Chase</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('alphabets', 'lowercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Bubble Chase</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('numbers', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Bubble Chase</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('colors', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Color Discriminant Bubble Chase</p>
          </div>
        </main>
      )}

      {view === 'game' && selectedModule === 'geoboard' && (
        <>
          <div className="max-w-6xl mx-auto w-full px-8 pt-8 pb-2">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Geoboard Module</h2>
            <p className="text-sm text-gray-500 font-medium mt-0.5">
              Select a board. Every pattern in the board runs in order, then the session report opens.
            </p>
          </div>
          <main className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5 px-8 py-6 max-w-6xl mx-auto w-full">
            {GEOBOARD_BOARD_IDS.map((id) => {
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
            })}
          </main>
        </>
      )}

      {/* GAME LAUNCHERS */}
      {view === 'play_rotatory' && (
        <RotatoryWheelGame
          initialMode={rotatoryConfig.mode}
          initialVariant={rotatoryConfig.variant}
          onExit={handleExitGame}
        />
      )}

      {view === 'play_sorting' && (
        <SortingGame variant={sortingVariant} onExit={handleExitGame} />
      )}

      {view === 'play_bee_tracing' && (
        <BeeTracingGame onExit={handleExitGame} />
      )}

      {view === 'play_pursuit' && (
        <PursuitGame onExit={handleExitGame} />
      )}

      {view === 'play_mobile_target' && (
        <MobileTargetGame
          initialMode={mobileTargetConfig.mode}
          initialVariant={mobileTargetConfig.variant}
          onExit={handleExitGame}
        />
      )}

      {view === 'play_geoboard' && (
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
