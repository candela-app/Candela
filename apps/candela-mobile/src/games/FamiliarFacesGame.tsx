import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DEFAULT_FAMILIAR_FACES_FLASH_MS,
  FAMILIAR_FACES_MIN_PHOTOS,
  buildFamiliarFacesQueue,
  buildFamiliarFacesTrial,
  clampFamiliarFacesFlashMs,
  familiarFacesChoiceIsCorrect,
  familiarFacesFlashLabel,
  familiarFacesLevelLabel,
  getDeviceTier,
  useHowToPlayGate,
  usePauseShiftedClock,
  buildSessionMetrics,
  captureReactionMs,
  type FamiliarFacePhoto,
  type FamiliarFacesLevelId,
  type FamiliarFacesSessionResultData,
  type FamiliarFacesTrial,
} from '@candela/shared/rn';
import { ClickToStartOverlay } from '../components/ClickToStartOverlay';
import { FamiliarFacesSetupModal } from '../components/FamiliarFacesSetupModal';
import { GameMenuDrawer } from '../components/GameMenuDrawer';
import { GameResultsModal } from '../components/GameResultsModal';
import { HowToPlayManual } from '../components/HowToPlayManual';
import { SlidersIcon } from '../components/icons';
import { listFamiliarFaces } from '../lib/api';
import { sessionDisplayName, useAuth } from '../lib/auth-context';
import { hapticCorrect, hapticMove, hapticWrong } from '../lib/haptics';
import { useLayout } from '../lib/layout';
import { speak, stopSpeaking } from '../lib/speech';
import { useGameSessionLock } from '../lib/use-game-session-lock';

type Phase = 'idle' | 'encode' | 'choose';

export function FamiliarFacesGame({
  onExit,
  levelId = 'name_it',
}: {
  onExit?: () => void;
  levelId?: string;
}) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width, s, fs } = useLayout();
  const deviceTier = useMemo(() => getDeviceTier(width), [width]);
  const { requestExit } = useGameSessionLock(onExit);
  const resolvedLevel = (
    levelId === 'find_them' || levelId === 'flash_match' ? levelId : 'name_it'
  ) as FamiliarFacesLevelId;
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

  const {
    showHowToPlay,
    howToPlayMode,
    isSettingsOpen,
    setIsSettingsOpen,
    finishHowToPlay,
    openHowToPlay,
    closeHowToPlay,
    playBlocked,
    isMenuOpen,
    setIsMenuOpen,
  } = useHowToPlayGate();

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

  useEffect(() => () => stopSpeaking(), []);

  usePauseShiftedClock(
    playBlocked,
    gameStarted && Boolean(startTimeRef.current),
    (delta) => {
      if (startTimeRef.current != null) startTimeRef.current += delta;
      if (shownAtRef.current != null) shownAtRef.current += delta;
    },
    startTimeRef.current,
  );

  const finishSession = useCallback(() => {
    stopSpeaking();
    const end = Date.now();
    const start = startTimeRef.current ?? end;
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
      ...buildSessionMetrics({
        correct,
        wrongTaps: wrong,
        reactionMs: reactionMsRef.current,
      }),
      levelId: resolvedLevel,
      flashMs,
      photosConfigured: photos.length,
      trialsCompleted: correct + wrong,
      endedBy: 'cleared',
      deviceTier,
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
    void hapticMove();
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
    const timer = setTimeout(() => goToChoices(), flashMs);
    return () => clearTimeout(timer);
  }, [flashMs, gameStarted, goToChoices, phase, playBlocked, queueIndex]);

  const handleChoice = (choiceId: string) => {
    if (!trial || !currentTarget || lockRef.current || phase !== 'choose') return;
    lockRef.current = true;
    setLocked(true);
    const shownAt = shownAtRef.current;
    if (shownAt != null) {
      const rt = captureReactionMs(performance.now(), shownAt);
      if (rt != null) reactionMsRef.current.push(rt);
    }
    const ok = familiarFacesChoiceIsCorrect(resolvedLevel, trial, choiceId, queue);
    setFeedbackId(choiceId);
    setFeedbackKind(ok ? 'correct' : 'wrong');
    if (ok) {
      correctRef.current += 1;
      void hapticCorrect();
    } else {
      wrongRef.current += 1;
      void hapticWrong();
    }
    setTimeout(() => {
      const nextIndex = queueIndex + 1;
      setQueueIndex(nextIndex);
      presentTrial(queue, nextIndex);
    }, 650);
  };

  const handleReset = () => {
    stopSpeaking();
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

  return (
    <View style={{ flex: 1, backgroundColor: '#06070D' }}>
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
          onExit={requestExit}
          startLabel={ready ? 'Click to Start' : 'Open album'}
        />
      ) : null}

      {gameStarted && currentTarget && trial ? (
        <View
          style={{
            flex: 1,
            paddingTop: insets.top + s(16),
            paddingBottom: insets.bottom + s(72),
            paddingHorizontal: s(16),
            alignItems: 'center',
            justifyContent: 'center',
            gap: s(16),
          }}
        >
          {gameStarted ? (
            <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: fs(13), position: 'absolute', top: insets.top + s(8), left: s(16) }}>
              {levelTitle} · {Math.min(queueIndex + 1, queue.length)}/{queue.length}
            </Text>
          ) : null}

          {phase === 'encode' ? (
            <>
              <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '900' }}>Look</Text>
              <Pressable onPress={goToChoices}>
                <Image
                  source={{ uri: currentTarget.imageUrl }}
                  style={{ width: s(220), height: s(220), borderRadius: s(24), backgroundColor: '#111827' }}
                />
              </Pressable>
              {flashMs <= 0 ? (
                <Text style={{ color: '#94A3B8', fontWeight: '700', fontSize: fs(13) }}>Tap the photo to continue</Text>
              ) : null}
            </>
          ) : null}

          {phase === 'choose' ? (
            <>
              {resolvedLevel === 'name_it' ? (
                <>
                  <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '900' }}>Who is this?</Text>
                  <Image
                    source={{ uri: currentTarget.imageUrl }}
                    style={{ width: s(180), height: s(180), borderRadius: s(20), backgroundColor: '#111827' }}
                  />
                </>
              ) : resolvedLevel === 'find_them' ? (
                <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '900', textAlign: 'center' }}>
                  Find {trial.promptLabel}
                </Text>
              ) : (
                <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '900' }}>Which face did you see?</Text>
              )}
              <View
                style={{
                  flexDirection: stackTwoPhotos ? 'column' : 'row',
                  flexWrap: 'wrap',
                  gap: s(12),
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                {trial.optionIds.map((optionId) => {
                  const photo = photoById(optionId);
                  const mark =
                    feedbackId === optionId
                      ? feedbackKind === 'correct'
                        ? '#34D399'
                        : '#F43F5E'
                      : '#1F2937';
                  if (trial.optionKind === 'label') {
                    return (
                      <Pressable
                        key={optionId}
                        disabled={locked}
                        onPress={() => handleChoice(optionId)}
                        style={{
                          minWidth: '46%',
                          paddingVertical: s(14),
                          borderRadius: s(16),
                          backgroundColor: mark,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(16) }}>{optionId}</Text>
                      </Pressable>
                    );
                  }
                  if (!photo) return null;
                  return (
                    <Pressable
                      key={optionId}
                      disabled={locked}
                      onPress={() => handleChoice(optionId)}
                      style={{
                        width: stackTwoPhotos ? '100%' : '46%',
                        borderRadius: s(16),
                        overflow: 'hidden',
                        borderWidth: 3,
                        borderColor: mark,
                      }}
                    >
                      <Image source={{ uri: photo.imageUrl }} style={{ width: '100%', height: s(140) }} />
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => setIsMenuOpen(true)}
        style={{ position: 'absolute', bottom: insets.bottom + 20, right: 16, padding: 10 }}
      >
        <SlidersIcon size={22} color="#cbd5e1" />
      </Pressable>

      <GameMenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        onQuit={() => {
          stopSpeaking();
          requestExit();
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
            requestExit();
          }}
          onReplay={() => {
            setIsResultsOpen(false);
            beginSession();
          }}
          data={resultsData}
        />
      ) : null}
    </View>
  );
}
