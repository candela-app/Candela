'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  WindChimeSettings,
  DEFAULT_WIND_CHIME_SETTINGS,
  ChimeStrikeEvent,
  ChimeSessionAnalytics,
  computeChimeSessionAnalytics,
} from '@candela/shared';
import { WindChimeCanvas } from './WindChimeCanvas';
import { WindChimeSettingsModal } from './WindChimeSettingsModal';
import { WindChimeAnalyticsModal } from './WindChimeAnalyticsModal';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { ResultsConfetti } from '../shared/ResultsConfetti';
import { PlayIcon, PauseIcon, SlidersIcon } from '../icons/VectorIcons';

export interface PediatricWindChimeGameProps {
  patientName?: string;
  onExit?: () => void;
  backHref?: string;
}

export const PediatricWindChimeGame: React.FC<PediatricWindChimeGameProps> = ({
  patientName = 'Pediatric Patient',
  onExit,
  backHref = '/dashboard',
}) => {
  // Game lifecycle states (Candela standard)
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [settings, setSettings] = useState<WindChimeSettings>(DEFAULT_WIND_CHIME_SETTINGS);
  const [strikeEvents, setStrikeEvents] = useState<ChimeStrikeEvent[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(settings.sessionDurationSec);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Floating menu states (matches Candela's AssistiveTouch pattern)
  const [isAssistiveTouchOpen, setIsAssistiveTouchOpen] = useState<boolean>(false);
  const [isHeaderExpanded, setIsHeaderExpanded] = useState<boolean>(false);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [confirmQuit, setConfirmQuit] = useState<boolean>(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(false);
  const [analyticsResult, setAnalyticsResult] = useState<ChimeSessionAnalytics | null>(null);

  // Sync timer when session duration setting changes
  useEffect(() => {
    setSecondsRemaining(settings.sessionDurationSec);
  }, [settings.sessionDurationSec]);

  // Session timer countdown
  useEffect(() => {
    if (!isGameStarted || isPaused || isResultsOpen || settings.sessionDurationSec === 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinishSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameStarted, isPaused, isResultsOpen, settings.sessionDurationSec, strikeEvents]);

  // Record strike event
  const handleStrikeEvent = useCallback((event: ChimeStrikeEvent) => {
    setStrikeEvents((prev) => [...prev, event]);
  }, []);

  // Start game handler
  const handleStartGame = () => {
    setIsGameStarted(true);
    setIsPaused(false);
    setNotification('Wind chime active — touch or swipe to play');
    setTimeout(() => setNotification(null), 3000);
  };

  // Finish session & compute analytics
  const handleFinishSession = () => {
    setIsPaused(true);
    setIsAssistiveTouchOpen(false);
    const duration = settings.sessionDurationSec > 0 ? settings.sessionDurationSec - secondsRemaining : 60;
    const computed = computeChimeSessionAnalytics(strikeEvents, Math.max(10, duration));
    setAnalyticsResult(computed);
    setIsResultsOpen(true);
  };

  // Reset / Play Again
  const handlePlayAgain = () => {
    setStrikeEvents([]);
    setSecondsRemaining(settings.sessionDurationSec);
    setIsPaused(false);
    setIsResultsOpen(false);
    setAnalyticsResult(null);
    setConfirmReset(false);
    setConfirmQuit(false);
  };

  // Exit game
  const handleExit = () => {
    if (onExit) {
      onExit();
    } else if (typeof window !== 'undefined') {
      window.location.href = backHref;
    }
  };

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-screen h-screen bg-[#0A0A12] text-white flex items-center justify-center select-none overflow-hidden touch-none relative font-sans">
      {/* TOP NOTIFICATION TOAST */}
      {notification && (
        <div className="fixed top-6 right-6 z-[300] flex items-center gap-2 bg-emerald-600/90 backdrop-blur-md text-white font-bold px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/30 text-sm animate-fade-in">
          ✓ {notification}
        </div>
      )}

      {/* CANDELA PRE-PLAY OVERLAY */}
      {!isGameStarted && !isSettingsOpen && !isResultsOpen && (
        <ClickToStartOverlay
          title="Wind Chime Harmony"
          hint="Touch or swipe the chimes and bottom wind sail to create soothing melodies"
          onStart={handleStartGame}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={handleExit}
        />
      )}

      {/* MAIN GAME CANVAS */}
      <main className="relative w-full h-full min-h-screen flex items-center justify-center p-0 overflow-hidden">
        <WindChimeCanvas
          settings={settings}
          onStrikeEvent={handleStrikeEvent}
          isPaused={!isGameStarted || isPaused}
        />
      </main>

      {/* TOP-LEFT QUIET TITLE BADGE */}
      {isGameStarted && !isResultsOpen && (
        <div className="fixed top-4 left-4 z-40 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs">
          <span className="font-bold text-white">Wind Chime Harmony</span>
          <span className="text-emerald-400">• Pediatric Sensory</span>
        </div>
      )}

      {/* TOP-RIGHT LIVE STATUS PILL */}
      {isGameStarted && !isResultsOpen && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs">
          {settings.sessionDurationSec > 0 ? (
            <span className="text-amber-300 font-bold">{formatTime(secondsRemaining)}</span>
          ) : (
            <span className="text-emerald-300 font-bold">Free Play</span>
          )}
          <span className="text-zinc-400">|</span>
          <span className="text-sky-300 font-semibold">{strikeEvents.length} notes</span>
        </div>
      )}

      {/* BOTTOM-RIGHT FLOATING CONTROLS GROUP (CANDELA STANDARD) */}
      {isGameStarted && !isResultsOpen && (
        <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity duration-200">
          <FullscreenToggleButton />

          {/* ASSISTIVETOUCH FLOATING ORB BUTTON */}
          <button
            onClick={() => {
              setIsAssistiveTouchOpen((prev) => !prev);
              setIsHeaderExpanded(false);
            }}
            className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 shadow-md flex items-center justify-center transition-all cursor-pointer backdrop-blur-md active:scale-95 group ${
              isAssistiveTouchOpen
                ? 'bg-[#1A2035] border-amber-400 text-white shadow-amber-500/30 ring-2 ring-amber-500/40'
                : 'bg-[#121626]/90 hover:bg-[#1A2035] border-amber-500/70 hover:border-amber-400 text-white'
            }`}
            title="Session controls"
          >
            <span className="text-sm">🎐</span>
          </button>
        </div>
      )}

      {/* ASSISTIVETOUCH EXPANDED MENU POPUP */}
      {isAssistiveTouchOpen && (
        <div className="fixed bottom-16 right-4 sm:bottom-20 sm:right-6 z-50 bg-[#121626]/95 border border-gray-800/90 p-4 rounded-3xl shadow-2xl backdrop-blur-xl flex flex-col gap-2.5 min-w-[210px] animate-slide-in-up">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
            <span className="text-xs font-extrabold text-gray-300 uppercase tracking-wider">
              Game Controls
            </span>
            <button
              onClick={() => setIsAssistiveTouchOpen(false)}
              className="text-gray-400 hover:text-white text-sm font-bold cursor-pointer p-0.5"
            >
              ✕
            </button>
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={() => setIsPaused((prev) => !prev)}
            className={`w-full py-2.5 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 border ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md'
                : 'bg-gray-800/90 hover:bg-gray-700 text-gray-200 border-gray-700'
            }`}
          >
            {isPaused ? <PlayIcon className="w-3.5 h-3.5" /> : <PauseIcon className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Clinical Settings */}
          <button
            onClick={() => {
              setIsAssistiveTouchOpen(false);
              setIsPaused(true);
              setIsSettingsOpen(true);
            }}
            className="w-full py-2.5 px-3 rounded-2xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700/80 flex items-center justify-center gap-2 text-xs font-bold"
          >
            <SlidersIcon className="w-3.5 h-3.5" />
            <span>Clinical Settings</span>
          </button>

          {/* Finish Session & View Report */}
          <button
            onClick={handleFinishSession}
            className="w-full py-2.5 px-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs transition-colors shadow-md text-center"
          >
            Finish & View Report
          </button>

          {/* Reset */}
          <button
            onClick={() => setConfirmReset(true)}
            className="w-full py-2 rounded-2xl bg-gray-800/90 hover:bg-gray-700 text-xs font-bold text-gray-300 transition-colors border border-gray-700 text-center"
          >
            Reset Game
          </button>

          {/* Quit */}
          <button
            onClick={() => setConfirmQuit(true)}
            className="w-full py-2 rounded-2xl bg-red-700 hover:bg-red-600 text-xs font-bold text-white transition-colors shadow-md text-center"
          >
            Quit Game
          </button>
        </div>
      )}

      {/* CONFIRM RESET DIALOG */}
      {confirmReset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#121626] border border-gray-800 p-6 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Reset this session?</h3>
            <p className="text-xs text-gray-400">All current strike notes and listening dwell timers will be reset.</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setConfirmReset(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmReset(false);
                  handlePlayAgain();
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-black"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM QUIT DIALOG */}
      {confirmQuit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#121626] border border-gray-800 p-6 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Quit session?</h3>
            <p className="text-xs text-gray-400">Return to the therapy dashboard.</p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setConfirmQuit(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-300"
              >
                Stay
              </button>
              <button
                onClick={() => {
                  setConfirmQuit(false);
                  handleExit();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white"
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLINICAL SETTINGS MODAL */}
      <WindChimeSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setIsPaused(false);
        }}
        currentSettings={settings}
        onApply={(newSettings) => setSettings(newSettings)}
      />

      {/* RESULTS CONFETTI & CLINICAL ANALYTICS REPORT */}
      {isResultsOpen && <ResultsConfetti />}
      {analyticsResult && (
        <WindChimeAnalyticsModal
          isOpen={isResultsOpen}
          onClose={() => setIsResultsOpen(false)}
          onPlayAgain={handlePlayAgain}
          analytics={analyticsResult}
          patientName={patientName}
        />
      )}
    </div>
  );
};
