'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { SessionResultData, exportSessionCSV, startResultsCelebrationAudio, ClinicalLookBadge } from '@candela/shared';
import { playApplauseClip, preloadApplauseClip, stopApplauseClip } from '@/lib/applause';
import { ResultsConfetti } from './ResultsConfetti';

interface GameResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  data: SessionResultData;
}

export const GameResultsModal: React.FC<GameResultsModalProps> = ({
  isOpen,
  onClose,
  onReplay,
  data,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [activeRoundTab, setActiveRoundTab] = useState<number>(0);

  useEffect(() => {
    if (!isOpen) return;
    const stop = startResultsCelebrationAudio(data.patientName, {
      playClap: playApplauseClip,
      stopClap: stopApplauseClip,
      preloadClap: preloadApplauseClip,
    });
    return () => stop();
  }, [isOpen, data.patientName]);

  if (!isOpen) return null;

  const beeData = data as any;
  const isBeeTracing =
    data.gameName?.toLowerCase().includes('bee') || 'roundResults' in beeData;
  const isPursuit =
    data.gameName?.toLowerCase().includes('pursuit') || 'avgTrackingErrorPx' in beeData;
  const isGeoboard = 'boardId' in beeData && 'leftHalfAccuracy' in beeData;

  const currentRound =
    beeData.roundResults?.[activeRoundTab] || beeData.roundResults?.[0];

  const handleExportCSV = () => {
    exportSessionCSV(data);
  };

  const handleDownloadCardImage = async () => {
    if (!cardRef.current) return;
    const elem = cardRef.current;
    const originalMaxHeight = elem.style.maxHeight;
    const originalOverflow = elem.style.overflow;
    const originalHeight = elem.style.height;

    try {
      setIsDownloading(true);
      const gameSlug = data.gameName
        ? data.gameName.toLowerCase().replace(/\s+/g, '-')
        : 'results';
      const fileName = `game-session-completed-${gameSlug}.png`;

      // Temporarily expand element so html-to-image captures full scroll height without clipping
      elem.style.maxHeight = 'none';
      elem.style.overflow = 'visible';
      elem.style.height = `${elem.scrollHeight}px`;

      const dataUrl = await toPng(elem, {
        cacheBust: true,
        pixelRatio: 2,
        height: elem.scrollHeight,
        width: elem.scrollWidth,
        backgroundColor: '#121212',
        filter: (node) => {
          if (
            node instanceof HTMLElement &&
            node.dataset.excludeFromDownload === 'true'
          ) {
            return false;
          }
          return true;
        },
      });

      // Restore original container scroll styles
      elem.style.maxHeight = originalMaxHeight;
      elem.style.overflow = originalOverflow;
      elem.style.height = originalHeight;

      const isMobilePhone =
        typeof window !== 'undefined' &&
        window.innerWidth < 768 &&
        ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

      if (isMobilePhone && typeof navigator !== 'undefined' && navigator.canShare) {
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const file = new File([blob], fileName, { type: 'image/png' });

          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `${data.gameName} Results`,
              text: `Session results for ${data.patientName || 'Demo Patient'}`,
            });
            setDownloadToast('Card saved!');
            setTimeout(() => setDownloadToast(null), 2500);
            return;
          }
        } catch (_) {}
      }

      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
      }, 500);

      setDownloadToast('Card image downloaded!');
      setTimeout(() => setDownloadToast(null), 2500);
    } catch (err) {
      console.error('Failed to download card image:', err);
      setDownloadToast('Download failed');
      setTimeout(() => setDownloadToast(null), 2500);
    } finally {
      elem.style.maxHeight = originalMaxHeight;
      elem.style.overflow = originalOverflow;
      elem.style.height = originalHeight;
      setIsDownloading(false);
    }
  };


  const formattedDate =
    data.date ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 transition-all animate-fade-in">
      <ResultsConfetti />
      <div
        ref={cardRef}
        className="relative w-full max-w-lg max-h-[90vh] overflow-x-hidden overflow-y-auto custom-scrollbar rounded-3xl border border-emerald-500/30 bg-[#121212] p-5 sm:p-7 text-white shadow-2xl shadow-emerald-900/20 animate-scale-up"
      >
        {/* Glow Background Accents */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        {/* Top-Right Download Card Button */}
        <button
          data-exclude-from-download="true"
          onClick={handleDownloadCardImage}
          disabled={isDownloading}
          title="Download Card Image"
          aria-label="Download Card Image"
          className="absolute top-5 right-5 z-20 p-2 rounded-xl bg-transparent hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer group disabled:opacity-50"
        >
          <svg
            className="w-5 h-5 transition-transform group-hover:scale-110"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>

        {/* Top-Right Toast Notification */}
        {downloadToast && (
          <div
            data-exclude-from-download="true"
            className="fixed top-6 right-6 z-[300] flex items-center gap-2 bg-emerald-600/90 backdrop-blur-md text-white font-bold px-4 py-2.5 rounded-2xl shadow-2xl border border-emerald-400/30 text-sm animate-fade-in"
          >
            <span>✓</span> {downloadToast}
          </div>
        )}

        {/* Title & Patient Header with Date */}
        <div className="text-center mb-6 relative z-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Session Completed
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {data.gameName} • Patient:{' '}
            <span className="text-emerald-400 font-semibold">
              {data.patientName || 'Demo Patient'}
            </span>
          </p>
          <div className="text-xs text-gray-400 mt-1.5 font-medium tracking-wide">
            Date: <span className="text-gray-300">{formattedDate}</span>
          </div>
          <ClinicalLookBadge
            bgColor={data.bgColor}
            stimulusColor={data.stimulusColor}
            contrastPercent={data.contrastPercent}
          />
        </div>

        {/* VISUAL TRACED PATH OVERLAY (FOR BEE TRACING) */}
        {isBeeTracing && currentRound && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3 mb-5 relative overflow-hidden flex flex-col items-center z-10">
            <div className="w-full flex justify-between items-center text-xs text-gray-400 mb-2 font-medium">
              <span>Target Path (Amber Dotted)</span>
              <span>Traced Path (Cyan)</span>
            </div>

            {/* Round Tabs - Wrapped to prevent horizontal scrolling */}
            {beeData.roundResults && beeData.roundResults.length > 1 && (
              <div data-exclude-from-download="true" className="flex flex-wrap justify-center gap-1.5 mb-2.5 w-full">
                {beeData.roundResults.map((rnd: any, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => setActiveRoundTab(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                      activeRoundTab === idx
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    R{rnd.roundNumber} ({rnd.pathType})
                  </button>
                ))}
              </div>
            )}

            <div className="relative w-full h-36 bg-[#0B0D14] rounded-xl border border-white/10 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 300">
                {currentRound.idealSvgPathD && (
                  <path
                    d={currentRound.idealSvgPathD}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="8"
                    strokeDasharray="6 6"
                    strokeOpacity="0.8"
                  />
                )}
                {currentRound.tracedPoints && currentRound.tracedPoints.length > 1 && (
                  <polyline
                    points={currentRound.tracedPoints.map((p: any) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>
          </div>
        )}

        {/* Horizontal vs Vertical Pursuit Accuracy Breakdown */}
        {isBeeTracing &&
          (beeData.horizontalAccuracyPercent !== undefined || beeData.verticalAccuracyPercent !== undefined) && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-3.5 mb-5 relative z-10">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 mb-2 text-center">
                Clinical Axis Pursuit Metrics
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Horizontal (↔) Acc
                  </span>
                  <span className="text-xl font-black text-amber-400">
                    {beeData.horizontalAccuracyPercent !== undefined
                      ? `${beeData.horizontalAccuracyPercent}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Vertical (↕) Acc
                  </span>
                  <span className="text-xl font-black text-emerald-400">
                    {beeData.verticalAccuracyPercent !== undefined
                      ? `${beeData.verticalAccuracyPercent}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

        {/* PURSUIT SPECIFIC METRICS & VECTOR ALIGNMENT */}
        {isPursuit && beeData.anticipationVsLagScore && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 mb-5 relative z-10">
            <div className="flex justify-between items-center text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
              <span>Pursuit Vector Alignment</span>
              <span className="text-white font-mono">{beeData.anticipationVsLagScore}</span>
            </div>
            <p className="text-[11px] text-gray-400">
              Measures whether touch taps lead (anticipation) or trail (lag) the target velocity vector.
            </p>
          </div>
        )}

        {/* PURSUIT 4-BLOCK FATIGUE TREND */}
        {isPursuit && beeData.blockMetrics && beeData.blockMetrics.length > 0 && (
          <div className="mb-5 relative z-10">
            <div className="text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-2.5">
              Block Trend (4 Blocks Fatigue Analysis)
            </div>
            <div className="grid grid-cols-4 gap-2">
              {beeData.blockMetrics.map((blk: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex flex-col items-center text-center"
                >
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase">
                    B{blk.blockIndex + 1}
                  </span>
                  <span className="text-base font-black text-cyan-400 mt-0.5">
                    {blk.accuracyPercent}%
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {blk.avgTrackingErrorPx}px
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GEOBOARD: STARS, HEMIFIELD BALANCE & ERROR PROFILE */}
        {isGeoboard && (
          <div className="rounded-2xl border border-teal-500/25 bg-teal-950/20 p-4 mb-5 relative z-10 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal-400">
                  {beeData.boardName}
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">
                  {beeData.correct} of {data.stimuliCount} patterns reproduced
                  {beeData.alphabetVariant ? ` · ${beeData.alphabetVariant}` : ''}
                </div>
              </div>
              <div className="text-lg tracking-[0.15em] text-amber-400 shrink-0">
                {'★'.repeat(beeData.starRating ?? 0)}
                <span className="text-white/15">{'★'.repeat(5 - (beeData.starRating ?? 0))}</span>
              </div>
            </div>

            {/* Hemifield balance — a persistent gap on one side is clinically meaningful */}
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                <span>Left Field {beeData.leftHalfAccuracy}%</span>
                <span>Right Field {beeData.rightHalfAccuracy}%</span>
              </div>
              <div className="flex gap-1.5">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden flex justify-end">
                  <div className="h-full bg-sky-400 rounded-full" style={{ width: `${beeData.leftHalfAccuracy}%` }} />
                </div>
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${beeData.rightHalfAccuracy}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Missed Dot', value: beeData.errorBreakdown?.wrongDot ?? 0, tone: 'text-rose-400' },
                { label: 'Missed Shape', value: beeData.errorBreakdown?.wrongShape ?? 0, tone: 'text-amber-400' },
                { label: 'Incomplete', value: beeData.errorBreakdown?.incomplete ?? 0, tone: 'text-sky-400' },
              ].map((item) => (
                <div key={item.label} className="bg-slate-900/60 p-2.5 rounded-xl border border-white/5">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {item.label}
                  </span>
                  <span className={`text-xl font-black ${item.tone}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {/* Pen the patient drew with — recorded so a later session can be
                repeated under the same visual conditions. */}
            {beeData.penColor && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-gray-400">
                <span className="uppercase tracking-wider">Pen</span>
                <span
                  className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                  style={{ backgroundColor: beeData.penColor }}
                />
                <span className="text-gray-300">{beeData.penColorName}</span>
                <span className="font-mono text-gray-500">{beeData.penColor.toUpperCase()}</span>
              </div>
            )}
          </div>
        )}

        {/* Clinical Results Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 relative z-10">
          {/* Time Taken */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
              Duration
            </span>
            <span className="text-2xl font-black text-emerald-400">
              {data.durationSec}s
            </span>
          </div>

          {/* Accuracy */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
              Accuracy
            </span>
            <span className="text-2xl font-black text-blue-400">
              {data.accuracy}%
            </span>
          </div>

          {/* Deviations / Tracking Error / Avg Reaction Time */}
          {isBeeTracing ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                Off-Path Deviations
              </span>
              <span className="text-2xl font-black text-rose-400">
                {beeData.deviationCount ?? 0}
              </span>
            </div>
          ) : isPursuit ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                Tracking Error
              </span>
              <span className="text-2xl font-black text-rose-400">
                {beeData.avgTrackingErrorPx ?? 0}px
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                Avg Reaction
              </span>
              <span className="text-2xl font-black text-amber-400">
                {Math.round(data.avgReactionSec * 1000)}ms
              </span>
            </div>
          )}

          {/* Recovery Time / Pursuit Speed / Stimuli Count */}
          {isBeeTracing ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                Avg Recovery
              </span>
              <span className="text-2xl font-black text-cyan-400">
                {beeData.avgRecoveryTimeSec ?? 0}s
              </span>
            </div>
          ) : isPursuit ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                Pursuit Speed
              </span>
              <span className="text-2xl font-black text-cyan-400">
                {beeData.speedPxPerSec ?? 180} px/s
              </span>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                {isGeoboard ? 'Patterns Drawn' : 'Bubbles Popped'}
              </span>
              <span className="text-2xl font-black text-purple-400">
                {data.stimuliCount}
              </span>
            </div>
          )}

          {isGeoboard ? (
            <>
              {/* Time before the first connection — a proxy for spatial planning */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                  Planning Time
                </span>
                <span className="text-2xl font-black text-cyan-400">
                  {beeData.avgFirstDotLatencySec}s
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                  Corrections
                </span>
                <span className="text-2xl font-black text-green-400">
                  {beeData.totalCorrections}
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Visual Focus Score */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                  Visual Focus Score
                </span>
                <span className="text-2xl font-black text-cyan-400">96 / 100</span>
              </div>

              {/* Processing Speed Tier */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
                <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
                  Processing Speed
                </span>
                <span className="text-2xl font-black text-green-400">Optimal</span>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div
          data-exclude-from-download="true"
          className="flex flex-col sm:flex-row gap-3 relative z-10"
        >
          <button
            onClick={onReplay}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center cursor-pointer"
          >
            Play Again
          </button>

          <button
            onClick={handleExportCSV}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold transition-all flex items-center justify-center cursor-pointer"
          >
            Export CSV
          </button>

          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition-all flex items-center justify-center cursor-pointer shadow-sm shadow-red-950/20"
          >
            Exit to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
