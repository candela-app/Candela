'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { RotatoryWheelGame } from '@/components/rotatoryModule/RotatoryWheelGame';
import { SortingGame } from '@/components/sortingModule/SortingGame';
import { BeeTracingGame } from '@/components/beeTrackingModule/BeeTracingGame';
import { PursuitGame } from '@/components/pursuitModule/PursuitGame';
import { GameMode, AlphabetVariant, SortingVariant, requestFullScreenSafe } from '@candela/shared';

type ActiveView = 'dashboard' | 'module' | 'game' | 'play_rotatory' | 'play_sorting' | 'play_bee_tracing' | 'play_pursuit';

function MainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [view, setView] = useState<ActiveView>('dashboard');
  const [selectedTherapy, setSelectedTherapy] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  const [rotatoryConfig, setRotatoryConfig] = useState<{ mode: GameMode; variant: AlphabetVariant }>({
    mode: 'alphabets',
    variant: 'uppercase',
  });
  const [sortingVariant, setSortingVariant] = useState<SortingVariant>('uppercase');

  // Sync state from URL Query Params
  useEffect(() => {
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
    } else if (gameParam === 'pursuit' || moduleParam === 'pursuit') {
      setSelectedTherapy('vision');
      setSelectedModule('pursuit');
      setView('play_pursuit');
    } else if (moduleParam) {
      setSelectedTherapy('vision');
      setSelectedModule(moduleParam);
      setView('game');
    } else if (therapy) {
      setSelectedTherapy(therapy);
      setView('module');
    } else {
      setSelectedTherapy(null);
      setSelectedModule(null);
      setView('dashboard');
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
    router.push(`/?${newParams.toString()}`);
  };

  const handleSelectTherapy = (id: string) => {
    updateQueryParams({ therapy: id, module: null, game: null, mode: null, variant: null });
  };

  const handleSelectModule = (id: string) => {
    if (id === 'tracing') {
      requestFullScreenSafe();
      updateQueryParams({ therapy: 'vision', module: 'tracing', game: 'bee_tracing', mode: null, variant: null });
    } else if (id === 'pursuit') {
      requestFullScreenSafe();
      updateQueryParams({ therapy: 'vision', module: 'pursuit', game: 'pursuit', mode: null, variant: null });
    } else {
      updateQueryParams({ therapy: 'vision', module: id, game: null, mode: null, variant: null });
    }
  };

  const handleLaunchRotatory = (mode: GameMode, variant: AlphabetVariant) => {
    requestFullScreenSafe();
    updateQueryParams({
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
      therapy: 'vision',
      module: 'sorting',
      game: 'sorting',
      mode: null,
      variant,
    });
  };

  const handleExitGame = () => {
    updateQueryParams({
      therapy: 'vision',
      module: null,
      game: null,
      mode: null,
      variant: null,
    });
  };

  return (
    <div className="w-screen h-screen grid grid-rows-[auto_1fr] bg-[#EAF4FF] select-none touch-manipulation">
      {/* HEADER SECTION (Tailwind CSS) */}
      {view !== 'play_rotatory' && view !== 'play_sorting' && view !== 'play_bee_tracing' && view !== 'play_pursuit' && (
        <header className="flex flex-row items-center justify-between px-6 py-4 bg-white shadow-sm">
          <div className="flex items-center gap-3">
            <h2
              className="text-[40px] md:text-[50px] font-bold text-[#1A1A1A] cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => updateQueryParams({ therapy: null, module: null, game: null, mode: null, variant: null })}
            >
              Candela
            </h2>
          </div>

          <div className="flex flex-row items-center justify-around text-center text-sm font-medium text-gray-600">
            <div className="text-sm text-gray-700 select-none">
              <span
                className="cursor-pointer hover:underline text-gray-700"
                onClick={() => updateQueryParams({ therapy: null, module: null, game: null, mode: null, variant: null })}
              >
                Dashboard
              </span>
              {selectedTherapy && (
                <>
                  {' › '}
                  <span
                    className="cursor-pointer hover:underline text-gray-700"
                    onClick={() => updateQueryParams({ therapy: 'vision', module: null, game: null, mode: null, variant: null })}
                  >
                    Vision Therapy
                  </span>
                </>
              )}
              {selectedModule && (
                <>
                  {' › '}
                  <span className="font-semibold text-gray-900">
                    {selectedModule === 'wheel'
                      ? 'Rotatory Module'
                      : selectedModule === 'sorting'
                      ? 'Sorting Module'
                      : selectedModule === 'tracing'
                      ? 'Bee Path Tracing'
                      : 'Pursuit Module'}
                  </span>
                </>
              )}
            </div>
          </div>
        </header>
      )}

      {/* DASHBOARD VIEW - ONLY VISION THERAPY CARD */}
      {view === 'dashboard' && (
        <main className="grid items-center justify-items-center grid-cols-1 gap-6 p-8 my-auto">
          <div
            className="h-[180px] w-full max-w-[360px] rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-6 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectTherapy('vision')}
          >
            <div className="text-4xl mb-2">👁️</div>
            <h3 className="m-0 text-[26px] font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors">
              Vision Therapy
            </h3>
            <p className="text-xs text-gray-500 mt-2 font-medium">
              Click to open Vision Therapy Modules
            </p>
          </div>
        </main>
      )}

      {/* MODULE SELECTION VIEW */}
      {view === 'module' && (
        <main className="grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8 my-auto max-w-6xl mx-auto w-full">
          <div
            className="h-[180px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-6 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('wheel')}
          >
            <div className="text-4xl mb-2">🎡</div>
            <h3 className="m-0 text-[22px] font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors">
              Rotatory Module
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Dynamic wheel tracking & visual pursuit exercises
            </p>
          </div>

          <div
            className="h-[180px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-6 border-2 border-transparent hover:border-blue-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('sorting')}
          >
            <div className="text-4xl mb-2">🧩</div>
            <h3 className="m-0 text-[22px] font-bold text-[#1A1A1A] group-hover:text-blue-600 transition-colors">
              Sorting Module
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Visual discrimination & sequential recognition
            </p>
          </div>

          <div
            className="h-[180px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-6 border-2 border-transparent hover:border-amber-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('tracing')}
          >
            <div className="text-4xl mb-2">🐝</div>
            <h3 className="m-0 text-[22px] font-bold text-[#1A1A1A] group-hover:text-amber-600 transition-colors">
              Bee Path Tracing
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Smooth pursuit tracking & visual-motor path control
            </p>
          </div>

          <div
            className="h-[180px] w-full rounded-[20px] bg-white shadow-md hover:shadow-2xl text-center flex flex-col justify-center items-center p-6 border-2 border-transparent hover:border-cyan-500 cursor-pointer transform hover:-translate-y-1 transition-all duration-200 group"
            onClick={() => handleSelectModule('pursuit')}
          >
            <div className="text-4xl mb-2">🎯</div>
            <h3 className="m-0 text-[22px] font-bold text-[#1A1A1A] group-hover:text-cyan-600 transition-colors">
              Pursuit Module
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Continuous visual pursuit & selective attention tracking
            </p>
          </div>
        </main>
      )}

      {/* GAME VARIANTS VIEW (Tailwind CSS) */}
      {view === 'game' && selectedModule === 'wheel' && (
        <main className="grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('alphabets', 'uppercase')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Uppercase Rotatory</p>
          </div>
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('alphabets', 'lowercase')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Lowercase Rotatory</p>
          </div>
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('numbers', 'uppercase')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Numeric Rotatory</p>
          </div>
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchRotatory('colors', 'uppercase')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Color Discriminant</p>
          </div>
        </main>
      )}

      {view === 'game' && selectedModule === 'sorting' && (
        <main className="grid items-center justify-items-center grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchSorting('uppercase')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Uppercase Alphabet Sorting</p>
          </div>
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchSorting('lowercase')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Lowercase Alphabet Sorting</p>
          </div>
          <div
            className="h-[160px] w-full max-w-[320px] rounded-[16px] bg-white shadow-md hover:shadow-xl text-center flex justify-center items-center p-4 border-2 border-transparent hover:border-black cursor-pointer transform hover:-translate-y-1 transition-all duration-200"
            onClick={() => handleLaunchSorting('numbers')}
          >
            <p className="m-0 text-[24px] font-semibold text-[#1A1A1A]">Numeric Sorting</p>
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
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-lg font-semibold">Loading Candela...</div>}>
      <MainContent />
    </Suspense>
  );
}

