'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotatoryWheelGame } from '@/components/rotatoryModule/RotatoryWheelGame';
import { SortingGame } from '@/components/sortingModule/SortingGame';
import { BeeTracingGame } from '@/components/beeTrackingModule/BeeTracingGame';
import { PursuitGame } from '@/components/pursuitModule/PursuitGame';
import { MobileTargetGame } from '@/components/mobileTargetModule/MobileTargetGame';
import { HomePageContent } from '@/components/home/HomePageContent';
import {
  EyeIcon,
  RotatoryIcon,
  PuzzleIcon,
  BeePathIcon,
  TargetIcon,
  MobileTargetIcon,
  HomeIcon,
  LayoutDashboardIcon,
  ArrowLeftIcon,
} from '@/components/icons/VectorIcons';
import { GameMode, AlphabetVariant, SortingVariant, requestFullScreenSafe } from '@candela/shared';

type ActiveView = 'home' | 'dashboard' | 'module' | 'game' | 'play_rotatory' | 'play_sorting' | 'play_bee_tracing' | 'play_pursuit' | 'play_mobile_target';

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

  // Sync state from URL Query Params
  useEffect(() => {
    const pageParam = searchParams.get('page');
    const therapy = searchParams.get('therapy');
    const moduleParam = searchParams.get('module');
    const gameParam = searchParams.get('game');
    const modeParam = searchParams.get('mode') as GameMode | null;
    const variantParam = searchParams.get('variant') as AlphabetVariant | SortingVariant | null;

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
    } else if (moduleParam) {
      setSelectedTherapy('vision');
      setSelectedModule(moduleParam);
      setView('game');
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
    updateQueryParams({ page: null, therapy: null, module: null, game: null, mode: null, variant: null });
  };

  const navigateToDashboard = () => {
    updateQueryParams({ page: 'dashboard', therapy: null, module: null, game: null, mode: null, variant: null });
  };

  const handleGoBack = () => {
    if (view === 'game') {
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: null, game: null, mode: null, variant: null });
    } else if (view === 'module') {
      updateQueryParams({ page: 'dashboard', therapy: null, module: null, game: null, mode: null, variant: null });
    } else if (view === 'dashboard') {
      navigateToHome();
    } else {
      navigateToHome();
    }
  };

  const handleSelectTherapy = (id: string) => {
    updateQueryParams({ page: 'dashboard', therapy: id, module: null, game: null, mode: null, variant: null });
  };

  const handleSelectModule = (id: string) => {
    if (id === 'tracing') {
      requestFullScreenSafe();
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: 'tracing', game: 'bee_tracing', mode: null, variant: null });
    } else if (id === 'pursuit') {
      requestFullScreenSafe();
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: 'pursuit', game: 'pursuit', mode: null, variant: null });
    } else {
      updateQueryParams({ page: 'dashboard', therapy: 'vision', module: id, game: null, mode: null, variant: null });
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

  const handleExitGame = () => {
    if (selectedModule && selectedModule !== 'pursuit' && selectedModule !== 'tracing') {
      updateQueryParams({
        page: 'dashboard',
        therapy: 'vision',
        module: selectedModule,
        game: null,
        mode: null,
        variant: null,
      });
    } else {
      updateQueryParams({
        page: 'dashboard',
        therapy: 'vision',
        module: null,
        game: null,
        mode: null,
        variant: null,
      });
    }
  };

  const isPlayingGame = view === 'play_rotatory' || view === 'play_sorting' || view === 'play_bee_tracing' || view === 'play_pursuit' || view === 'play_mobile_target';

  return (
    <div className={`w-screen ${isPlayingGame ? 'h-screen overflow-hidden' : 'min-h-screen overflow-y-auto flex flex-col'} bg-[#EAF4FF] select-none touch-manipulation`}>
      {/* HEADER NAVBAR SECTION */}
      {!isPlayingGame && (
        <header className="sticky top-0 z-50 flex flex-row items-center justify-between px-6 py-4 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 gap-4">
          {/* LEFT: BRAND LOGO */}
          <h2
            className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] tracking-tight cursor-pointer hover:opacity-80 transition-opacity"
            onClick={navigateToHome}
          >
            Kandela
          </h2>

          {/* RIGHT: BACK BUTTON & DASHBOARD BUTTON */}
          <div className="flex items-center gap-3">
            {/* Back button (only shown when inside dashboard / sub-views) */}
            {view !== 'home' && (
              <button
                onClick={handleGoBack}
                className="px-3.5 py-1.5 rounded-xl bg-gray-100/90 hover:bg-gray-200/80 text-gray-700 text-sm font-semibold transition-all flex items-center gap-1.5 border border-gray-200/60 shadow-xs active:scale-95"
              >
                <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
                <span>Back</span>
              </button>
            )}

            {/* Dashboard button */}
            <button
              onClick={navigateToDashboard}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 border ${
                view !== 'home'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-blue-600 border-gray-200 shadow-sm hover:bg-blue-50'
              }`}
            >
              <LayoutDashboardIcon className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
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
            className="h-[200px] w-full max-w-[400px] rounded-[24px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-8 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectTherapy('vision')}
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <EyeIcon className="w-10 h-10" />
            </div>
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
        <main className="flex-1 grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8 my-auto max-w-6xl mx-auto w-full">
          <div
            className="h-[210px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-between items-center p-6 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('wheel')}
          >
            <div className="w-14 h-14 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <RotatoryIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors">
                Rotatory Module
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Dynamic wheel tracking & visual pursuit exercises
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 shadow-2xs">
              For Tabs
            </span>
          </div>

          <div
            className="h-[210px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-between items-center p-6 border-2 border-transparent hover:border-purple-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('sorting')}
          >
            <div className="w-14 h-14 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <PuzzleIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-purple-600 transition-colors">
                Sorting Module
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Visual discrimination & sequential recognition
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 shadow-2xs">
              For Tabs & Mobile
            </span>
          </div>

          <div
            className="h-[210px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-between items-center p-6 border-2 border-transparent hover:border-amber-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('tracing')}
          >
            <div className="w-14 h-14 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BeePathIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-amber-600 transition-colors">
                Bee Path Tracing
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Smooth pursuit tracking & visual-motor path control
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
              For Touch & Stylus
            </span>
          </div>

          <div
            className="h-[210px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-between items-center p-6 border-2 border-transparent hover:border-cyan-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('pursuit')}
          >
            <div className="w-14 h-14 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <TargetIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-cyan-600 transition-colors">
                Pursuit Module
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                Continuous visual pursuit & selective attention tracking
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/60 shadow-2xs">
              For All Devices
            </span>
          </div>

          <div
            className="h-[210px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-between items-center p-6 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('mobile_target')}
          >
            <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <MobileTargetIcon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="m-0 text-[20px] font-bold text-[#1A1A1A] group-hover:text-emerald-600 transition-colors">
                Mobile Target Pursuit
              </h3>
              <p className="text-xs text-gray-500 mt-1 font-medium">
                2-target bouncing pursuit with set timers & high contrast dark field
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60 shadow-2xs">
              For Mobile & Tabs
            </span>
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
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Uppercase Mobile Pursuit</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('alphabets', 'lowercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Lowercase Mobile Pursuit</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('numbers', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Numeric Mobile Pursuit</p>
          </div>
          <div
            className="h-[160px] w-full rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-emerald-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchMobileTarget('colors', 'uppercase')}
          >
            <p className="m-0 text-[22px] font-semibold text-[#1A1A1A]">Color Discriminant Pursuit</p>
          </div>
        </main>
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
