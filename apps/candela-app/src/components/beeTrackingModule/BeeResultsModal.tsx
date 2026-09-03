'use client';

import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { BeeSessionResultData, exportSessionCSV, parentSummaryCells, sessionErrorCounts } from '@candela/shared';
import { useSavedSessionNumber } from '@/lib/use-saved-session-number';

interface BeeResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  data: BeeSessionResultData;
}

export const BeeResultsModal: React.FC<BeeResultsModalProps> = ({
  isOpen,
  onClose,
  onReplay,
  data,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [activeRoundTab, setActiveRoundTab] = useState<number>(0);
  const [resultsTab, setResultsTab] = useState<'summary' | 'advanced'>('summary');
  const { sessionNumber, status: sessionSaveStatus } = useSavedSessionNumber(isOpen, data);

  if (!isOpen) return null;

  const currentRound = data.roundResults[activeRoundTab] || data.roundResults[0];
  const parentCells = parentSummaryCells(data);
  const errors = sessionErrorCounts(data);

  const handleExportCSV = () => {
    exportSessionCSV(data);
  };

  const handleDownloadCardImage = async () => {
    if (!cardRef.current) return;
    try {
      setIsDownloading(true);
      const fileName = `bee-tracing-results-${data.patientName || 'patient'}.png`;

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#12141C',
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
              title: `Bee Tracing Session Results`,
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
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 500);

      setDownloadToast('Card downloaded!');
      setTimeout(() => setDownloadToast(null), 2500);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Calculate star rating for child view (3 stars max)
  const accuracy = data.accuracy;
  const starsCount = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div
        ref={cardRef}
        className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-amber-500/30 bg-[#12141C] p-6 sm:p-8 text-white shadow-2xl"
      >
        {/* Top-Right Action Buttons */}
        <button
          data-exclude-from-download="true"
          onClick={handleDownloadCardImage}
          disabled={isDownloading}
          title="Download Results Card"
          className="absolute top-5 right-5 z-20 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 transition-all cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </button>

        {downloadToast && (
          <div
            data-exclude-from-download="true"
            className="fixed top-6 right-6 z-[300] bg-emerald-600/90 text-white font-bold px-4 py-2 rounded-2xl shadow-xl text-sm"
          >
            ✓ {downloadToast}
          </div>
        )}

        {/* Child-Friendly Header & Star Burst */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🐝 🌸</div>
          <h2 className="text-2xl sm:text-3xl font-black text-amber-400">
            Great Pursuit Tracking!
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Patient: <span className="text-white font-semibold">{data.patientName || 'Demo Patient'}</span>
            {' · '}
            Session #: {sessionNumber != null ? sessionNumber : sessionSaveStatus === 'saving' ? 'saving…' : '—'}
            {' · '}
            Mode:{' '}
            <span className="text-amber-300 capitalize">{data.tracingMode}</span>
          </p>

          {/* Stars */}
          <div className="flex justify-center items-center gap-2 mt-3 text-3xl">
            {[1, 2, 3].map((star) => (
              <span
                key={star}
                className={star <= starsCount ? 'opacity-100 scale-110' : 'opacity-30 grayscale'}
              >
                ⭐
              </span>
            ))}
          </div>
        </div>

        <div
          data-exclude-from-download="true"
          className="flex bg-white/5 p-1 rounded-xl mb-5 border border-white/10"
        >
          <button
            type="button"
            onClick={() => setResultsTab('summary')}
            className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all ${
              resultsTab === 'summary'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Summary
          </button>
          <button
            type="button"
            onClick={() => setResultsTab('advanced')}
            className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all ${
              resultsTab === 'advanced'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Advanced
          </button>
        </div>

        {resultsTab === 'summary' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {parentCells.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"
                >
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
                    {item.label}
                  </span>
                  <span className="text-2xl font-black" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-300">
                Wrong taps {errors.wrongTaps}
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-300">
                Misses {errors.misses}
              </span>
              {errors.timeouts > 0 && (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold text-sky-300">
                  Timeouts {errors.timeouts}
                </span>
              )}
            </div>
          </>
        )}

        {resultsTab === 'advanced' && (
          <>
        {/* Set Round Selector Tabs */}
        {data.roundResults.length > 0 && (
          <div data-exclude-from-download="true" className="mb-4">
            <label className="block text-xs uppercase tracking-wider font-semibold text-gray-400 mb-2 text-center">
              Visual Trace by Round (Select to inspect)
            </label>
            <div className="flex justify-center gap-2">
              {data.roundResults.map((rnd, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveRoundTab(idx)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeRoundTab === idx
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  Round {rnd.roundNumber} ({rnd.pathType})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visual Traced Path vs Target Overlay Canvas representation */}
        {currentRound && (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 mb-6 relative overflow-hidden flex flex-col items-center">
            <div className="w-full flex justify-between items-center text-xs text-gray-400 mb-2 font-medium">
              <span>🎯 Target Path (Amber Dotted)</span>
              <span>✏️ Actual Patient Trace (Cyan)</span>
            </div>
            <div className="relative w-full h-44 bg-[#0B0D14] rounded-xl border border-white/10 flex items-center justify-center overflow-hidden">
              <svg className="w-full h-full" viewBox="0 0 600 300">
                {/* Target Path */}
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
                {/* User Traced Path */}
                {currentRound.tracedPoints && currentRound.tracedPoints.length > 1 && (
                  <polyline
                    points={currentRound.tracedPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                {/* Hive Start */}
                {currentRound.targetPoints[0] && (
                  <g transform={`translate(${currentRound.targetPoints[0].x}, ${currentRound.targetPoints[0].y})`}>
                    <circle r="12" fill="#EAB308" opacity="0.9" />
                    <text textAnchor="middle" dy="4" fontSize="12">
                      🐝
                    </text>
                  </g>
                )}
                {/* Flower Target */}
                {currentRound.targetPoints[currentRound.targetPoints.length - 1] && (
                  <g
                    transform={`translate(${currentRound.targetPoints[currentRound.targetPoints.length - 1].x}, ${
                      currentRound.targetPoints[currentRound.targetPoints.length - 1].y
                    })`}
                  >
                    <circle r="14" fill="#EC4899" opacity="0.9" />
                    <text textAnchor="middle" dy="4" fontSize="12">
                      🌸
                    </text>
                  </g>
                )}
              </svg>
            </div>
          </div>
        )}

        {/* Clinical Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Path Accuracy
            </span>
            <span className="text-2xl font-black text-amber-400">{data.accuracy}%</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Set Duration
            </span>
            <span className="text-2xl font-black text-emerald-400">{data.durationSec}s</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Off-Path Deviations
            </span>
            <span className="text-2xl font-black text-rose-400">{data.deviationCount}</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Avg Recovery Time
            </span>
            <span className="text-2xl font-black text-cyan-400">{data.avgRecoveryTimeSec}s</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Tolerance Band
            </span>
            <span className="text-xl font-black text-purple-400">{data.toleranceBandPx}px</span>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-400 block mb-1">
              Rounds Completed
            </span>
            <span className="text-xl font-black text-blue-400">{data.roundsCompleted}</span>
          </div>
        </div>
          </>
        )}

        {/* Modal Actions */}
        <div data-exclude-from-download="true" className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onReplay}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black shadow-lg transition-all flex items-center justify-center cursor-pointer"
          >
            Start Next Set 🚀
          </button>

          <button
            onClick={handleExportCSV}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold transition-all flex items-center justify-center cursor-pointer"
          >
            Export CSV
          </button>

          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition-all flex items-center justify-center cursor-pointer"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
};
