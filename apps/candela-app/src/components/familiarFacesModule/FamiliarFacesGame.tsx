'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_FAMILIAR_FACES_FLASH_MS,
  FAMILIAR_FACES_MIN_PHOTOS,
  buildFamiliarFacesQueue,
  buildFamiliarFacesTrial,
  clampFamiliarFacesFlashMs,
  familiarFacesAccuracy,
  familiarFacesChoiceIsCorrect,
  familiarFacesFlashLabel,
  familiarFacesLevelLabel,
  getDeviceTier,
  playSuccessSoundAndHaptic,
  playWhooshSoundAndHaptic,
  playWrongSoundAndHaptic,
  reactionStatsFromMs,
  requestFullScreenSafe,
  useHowToPlayGate,
  usePauseShiftedClock,
  type FamiliarFacePhoto,
  type FamiliarFacesLevelId,
  type FamiliarFacesSessionResultData,
  type FamiliarFacesTrial,
} from '@candela/shared';
import { sessionDisplayName, useAuth } from '@/lib/auth-context';
import { listFamiliarFaces } from '@/lib/api';
import { GameMenuDrawer } from '../shared/GameMenuDrawer';
import { FullscreenToggleButton } from '../shared/FullscreenToggleButton';
import { GameResultsModal } from '../shared/GameResultsModal';
import { useGameSessionLock } from '../shared/useGameSessionLock';
import { ClickToStartOverlay } from '../shared/ClickToStartOverlay';
import { HowToPlayManual } from '../shared/HowToPlayManual';
import { FamiliarFacesSetupModal } from './FamiliarFacesSetupModal';
import styles from './FamiliarFacesGame.module.css';

interface FamiliarFacesGameProps {
  onExit?: () => void;
  levelId?: string;
}

type Phase = 'idle' | 'encode' | 'choose';

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

function stopSpeak() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function FamiliarFacesGame({ onExit, levelId = 'name_it' }: FamiliarFacesGameProps) {
  const { session } = useAuth();
  const deviceTier = useMemo(() => getDeviceTier(), []);
  const resolvedLevel = (levelId === 'find_them' || levelId === 'flash_match' ? levelId : 'name_it') as FamiliarFacesLevelId;
  const levelTitle = familiarFacesLevelLabel(resolvedLevel);
  const levelHint =
    resolvedLevel === 'find_them'
      ? 'Hear or read a relation, then tap that person.'
      : resolvedLevel === 'flash_match'
        ? 'A face appears, then hides. Tap the same face from the choices.'
        : 'Look at the photo, then tap who it is.';

  const [photos, setPhotos] = useState<FamiliarFacePhoto[]>([]);
  const [flashMs, setFlashMs] = useState(DEFAULT_FAMILIAR_FACES_FLASH_MS);
  const [gameStarted, setGameStarted] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [queue, setQueue] = useState<FamiliarFacePhoto[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [trial, setTrial] = useState<FamiliarFacesTrial | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<'correct' | 'wrong' | null>(null);
  const [locked, setLocked] = useState(false);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [resultsData, setResultsData] = useState<FamiliarFacesSessionResultData | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const shownAtRef = useRef<number | null>(null);
  const correctRef = useRef(0);
  const wrongRef = useRef(0);
  const reactionMsRef = useRef<number[]>([]);
  const lockRef = useRef(false);

  const { showHowToPlay, howToPlayMode, isSettingsOpen, setIsSettingsOpen, finishHowToPlay, openHowToPlay, closeHowToPlay, playBlocked, isMenuOpen, setIsMenuOpen } =
    useHowToPlayGate();
  useGameSessionLock(true);

  const patientName = sessionDisplayName(session);
  const ready = photos.length >= FAMILIAR_FACES_MIN_PHOTOS;
  const currentTarget = queue[queueIndex] ?? null;

  const loadAlbum = useCallback(() => {
    void listFamiliarFaces()
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, []);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  useEffect(() => () => stopSpeak(), []);

  usePauseShiftedClock(playBlocked, gameStarted && Boolean(startTimeRef.current), (delta) => {
    if (startTimeRef.current != null) startTimeRef.current += delta;
    if (shownAtRef.current != null) shownAtRef.current += delta;
  }, startTimeRef.current);

  const finishSession = useCallback(() => {
    stopSpeak();
    const end = Date.now();
    const start = startTimeRef.current ?? end;
    const reaction = reactionStatsFromMs(reactionMsRef.current);
    const correct = correctRef.current;
    const wrong = wrongRef.current;
    const data: FamiliarFacesSessionResultData = {
      patientName,
      sessionId: Date.now(),
      date: new Date().toISOString(),
      gameName: `Familiar Faces · ${levelTitle}`,
      stimuliCount: photos.length,
      letterSize: 1,
      speed: familiarFacesFlashLabel(flashMs),
      durationSec: Math.max(1, Math.round((end - start) / 1000)),
      clicksTotal: correct + wrong,
      correct,
      wrong,
      accuracy: familiarFacesAccuracy(correct, wrong),
      avgReactionSec: reaction.avgSec,
      levelId: resolvedLevel,
      flashMs,
      photosConfigured: photos.length,
      trialsCompleted: correct + wrong,
      endedBy: 'cleared',
      deviceTier,
      medianReactionSec: reaction.medianSec,
    };
    setResultsData(data);
    setIsResultsOpen(true);
    setGameStarted(false);
    setPhase('idle');
    setTrial(null);
  }, [deviceTier, flashMs, levelTitle, patientName, photos.length, resolvedLevel]);

  const presentTrial = useCallback(
    (nextQueue: FamiliarFacePhoto[], index: number) => {
      const target = nextQueue[index];
      if (!target) {
        finishSession();
        return;
      }
      const nextTrial = buildFamiliarFacesTrial(resolvedLevel, target, nextQueue);
      setTrial(nextTrial);
      setFeedbackId(null);
      setFeedbackKind(null);
      setLocked(false);
      lockRef.current = false;
      shownAtRef.current = performance.now();
      if (resolvedLevel === 'flash_match') {
        setPhase('encode');
        speak('Look');
      } else if (resolvedLevel === 'find_them') {
        setPhase('choose');
        speak(`Find ${nextTrial.promptLabel}`);
      } else {
        setPhase('choose');
        speak('Who is this?');
      }
    },
    [finishSession, resolvedLevel],
  );

  const beginSession = useCallback(() => {
    if (photos.length < FAMILIAR_FACES_MIN_PHOTOS) {
      setIsSettingsOpen(true);
      return;
    }
    requestFullScreenSafe();
    playWhooshSoundAndHaptic();
    correctRef.current = 0;
    wrongRef.current = 0;
    reactionMsRef.current = [];
    startTimeRef.current = Date.now();
    const nextQueue = buildFamiliarFacesQueue(photos);
    setQueue(nextQueue);
    setQueueIndex(0);
    setGameStarted(true);
    setIsResultsOpen(false);
    presentTrial(nextQueue, 0);
  }, [photos, presentTrial, setIsSettingsOpen]);

  const goToChoices = useCallback(() => {
    if (phase !== 'encode') return;
    setPhase('choose');
    speak('Which face did you see?');
    shownAtRef.current = performance.now();
  }, [phase]);

  useEffect(() => {
    if (!gameStarted || phase !== 'encode' || playBlocked) return;
    if (flashMs <= 0) return;
    const timer = window.setTimeout(() => goToChoices(), flashMs);
    return () => window.clearTimeout(timer);
  }, [flashMs, gameStarted, goToChoices, phase, playBlocked, queueIndex]);

  const handleChoice = (choiceId: string) => {
    if (!trial || !currentTarget || lockRef.current || phase !== 'choose') return;
    lockRef.current = true;
    setLocked(true);
    const shownAt = shownAtRef.current;
    if (shownAt != null) reactionMsRef.current.push(performance.now() - shownAt);
    const ok = familiarFacesChoiceIsCorrect(resolvedLevel, trial, choiceId, queue);
    setFeedbackId(choiceId);
    setFeedbackKind(ok ? 'correct' : 'wrong');
    if (ok) {
      correctRef.current += 1;
      playSuccessSoundAndHaptic();
    } else {
      wrongRef.current += 1;
      playWrongSoundAndHaptic();
    }
    window.setTimeout(() => {
      const nextIndex = queueIndex + 1;
      setQueueIndex(nextIndex);
      presentTrial(queue, nextIndex);
    }, 650);
  };

  const handleReset = () => {
    stopSpeak();
    setGameStarted(false);
    setPhase('idle');
    setTrial(null);
    setIsResultsOpen(false);
    setIsMenuOpen(false);
  };

  const photoById = useCallback(
    (id: string) => photos.find((photo) => photo.id === id) || queue.find((photo) => photo.id === id),
    [photos, queue],
  );

  const photoChoiceCount = trial?.optionKind === 'photo' ? trial.optionIds.length : 0;
  const stackTwoPhotos = photoChoiceCount === 2;
  const choiceColumns = trial?.optionKind === 'photo' && !stackTwoPhotos ? Math.min(2, photoChoiceCount) : 1;

  return (
    <div className={styles.shell}>
      <HowToPlayManual
        moduleId="familiar_faces"
        isOpen={showHowToPlay}
        mode={howToPlayMode}
        onContinue={finishHowToPlay}
        onClose={closeHowToPlay}
      />
      <FamiliarFacesSetupModal
        isOpen={isSettingsOpen}
        levelId={resolvedLevel}
        flashMs={flashMs}
        onFlashMsChange={(value) => setFlashMs(clampFamiliarFacesFlashMs(value))}
        photos={photos}
        onPhotosChange={setPhotos}
        onClose={() => setIsSettingsOpen(false)}
      />

      {!showHowToPlay && !isSettingsOpen && !gameStarted && !isResultsOpen ? (
        <ClickToStartOverlay
          title={levelTitle}
          hint={ready ? levelHint : `Add at least ${FAMILIAR_FACES_MIN_PHOTOS} photos in settings to play.`}
          onStart={ready ? beginSession : () => setIsSettingsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExit={onExit}
          startLabel={ready ? 'Click to Start' : 'Open album'}
        />
      ) : null}

      <div className={styles.hud} style={{ pointerEvents: 'none' }}>
        <div>
          <p className={styles.hudAccent}>{levelTitle}</p>
          {gameStarted ? (
            <p className={styles.hudText}>
              {Math.min(queueIndex + 1, queue.length)}/{queue.length}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1" style={{ pointerEvents: 'auto' }}>
          <FullscreenToggleButton />
          <button type="button" className={styles.menuFab} onClick={() => setIsMenuOpen(true)} aria-label="Open menu">
            ☰
          </button>
        </div>
      </div>

      {gameStarted && currentTarget && trial ? (
        <div className={styles.playField}>
          {phase === 'encode' ? (
            <>
              <p className={styles.prompt}>Look</p>
              <button type="button" className={styles.probePhoto} onClick={goToChoices}>
                <img src={currentTarget.imageUrl} alt="" />
              </button>
              {flashMs <= 0 ? <p className={styles.tapHint}>Tap the photo to continue</p> : null}
            </>
          ) : null}

          {phase === 'choose' ? (
            <>
              {resolvedLevel === 'name_it' ? (
                <>
                  <p className={styles.prompt}>Who is this?</p>
                  <div className={styles.probePhoto}>
                    <img src={currentTarget.imageUrl} alt="" />
                  </div>
                </>
              ) : resolvedLevel === 'find_them' ? (
                <p className={styles.prompt}>Find {trial.promptLabel}</p>
              ) : (
                <p className={styles.prompt}>Which face did you see?</p>
              )}
              <div
                className={`${styles.choiceGrid} ${stackTwoPhotos ? styles.choiceGridTwo : ''}`}
                style={
                  stackTwoPhotos
                    ? undefined
                    : { gridTemplateColumns: `repeat(${choiceColumns}, minmax(0, 1fr))` }
                }
              >
                {trial.optionIds.map((optionId) => {
                  const photo = photoById(optionId);
                  const mark =
                    feedbackId === optionId ? (feedbackKind === 'correct' ? styles.choiceCorrect : styles.choiceWrong) : '';
                  if (trial.optionKind === 'label') {
                    return (
                      <button
                        key={optionId}
                        type="button"
                        className={`${styles.choiceLabel} ${mark}`}
                        disabled={locked}
                        onClick={() => handleChoice(optionId)}
                      >
                        {optionId}
                      </button>
                    );
                  }
                  if (!photo) return null;
                  return (
                    <button
                      key={optionId}
                      type="button"
                      className={`${styles.choicePhoto} ${mark}`}
                      disabled={locked}
                      onClick={() => handleChoice(optionId)}
                    >
                      <img src={photo.imageUrl} alt={photo.relationLabel} />
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          stopSpeak();
          onExit?.();
        }}
        onReset={handleReset}
        onOpenSettings={() => {
          setIsMenuOpen(false);
          setIsSettingsOpen(true);
        }}
        onOpenHowToPlay={() => {
          setIsMenuOpen(false);
          openHowToPlay();
        }}
        settingsSummary={[
          { label: 'Level', value: levelTitle },
          { label: 'Photos', value: String(photos.length) },
          ...(resolvedLevel === 'flash_match'
            ? [{ label: 'Flash', value: familiarFacesFlashLabel(flashMs) }]
            : []),
        ]}
        sessionInProgress={gameStarted}
      />

      {resultsData ? (
        <GameResultsModal
          isOpen={isResultsOpen}
          onClose={() => {
            setIsResultsOpen(false);
            onExit?.();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            beginSession();
          }}
          data={resultsData}
        />
      ) : null}
    </div>
  );
}
