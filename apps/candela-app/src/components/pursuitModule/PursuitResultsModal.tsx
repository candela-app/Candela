'use client';

import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { PursuitSessionResultData, exportSessionCSV } from '@candela/shared';

interface PursuitResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  data: PursuitSessionResultData;
}

export const PursuitResultsModal: React.FC<PursuitResultsModalProps> = ({
  isOpen,
  onClose,
  onReplay,
  data,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewTab, setViewTab] = useState<'child' | 'doctor'>('child');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  if (!isOpen) return null;

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
      const fileName = `pursuit-session-${data.patientName || 'patient'}.png`;

      elem.style.maxHeight = 'none';
      elem.style.overflow = 'visible';
      elem.style.height = `${elem.scrollHeight}px`;

      const dataUrl = await toPng(elem, {
        cacheBust: true,
        pixelRatio: 2,
        height: elem.scrollHeight,
        width: elem.scrollWidth,
        backgroundColor: '#090A0F',
        filter: (node) => {
          if (node instanceof HTMLElement && node.dataset.excludeFromDownload === 'true') {
            return false;
          }
          return true;
        },
      });

      elem.style.maxHeight = originalMaxHeight;
      elem.style.overflow = originalOverflow;
      elem.style.height = originalHeight;

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

      setDownloadToast('Card downloaded!');
      setTimeout(() => setDownloadToast(null), 2500);
    } catch (err) {
      console.error('Failed to download card:', err);
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

  const starCount = Math.max(1, Math.min(5, data.starRating || Math.ceil((data.accuracy / 100) * 5)));
  const starsString = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 transition-all animate-fade-in overflow-y-auto">
      <div
        ref={cardRef}
        className="relative w-full max-w-xl max-h-[90vh] overflow-x-hidden overflow-y-auto custom-scrollbar touch-pan-y rounded-3xl border border-cyan-500/30 bg-[#090A0F] p-6 sm:p-8 text-white shadow-2xl shadow-cyan-950/40 mb-6 pb-6"
      >
        {/* Glow Accents */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        {/* Header Bar with View Switcher */}
        <div className="flex justify-between items-center mb-6 relative z-10">
          <div>
            <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest block">
              Vision Pursuit Therapy
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Session Completed
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Patient: <strong className="text-white">{data.patientName || 'Demo Patient'}</strong> • {formattedDate}
            </p>
          </div>

          <button
            data-exclude-from-download="true"
            onClick={handleDownloadCardImage}
            disabled={isDownloading}
            className="p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-all cursor-pointer"
            title="Download Summary Card PNG"
          >
            📥
          </button>
        </div>

        {/* View Selector Tabs (Child vs Doctor) */}
        <div data-exclude-from-download="true" className="flex bg-[#12141F] p-1 rounded-xl mb-6 border border-gray-800">
          <button
            type="button"
            onClick={() => setViewTab('child')}
            className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all ${
              viewTab === 'child'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🌟 Child Summary Card
          </button>
          <button
            type="button"
            onClick={() => setViewTab('doctor')}
            className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all ${
              viewTab === 'doctor'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🩺 Doctor / Clinical Dashboard
          </button>
        </div>

        {/* Toast */}
        {downloadToast && (
          <div data-exclude-from-download="true" className="fixed top-6 right-6 z-[300] bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl shadow-xl text-xs">
            ✓ {downloadToast}
          </div>
        )}

        {/* CHILD-FACING VIEW: 2 Headline Numbers & Friendly Celebratory Tone */}
        {viewTab === 'child' && (
          <div className="flex flex-col items-center text-center py-4 gap-6 animate-fade-in">
            <div className="text-6xl animate-bounce">🎯</div>
            <div>
              <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Fantastic Tracking!
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                You visually pursued moving targets with great accuracy!
              </p>
            </div>

            {/* 2 Headline Numbers Max */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
              <div className="bg-[#121522] border border-cyan-500/30 p-5 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Tracking Accuracy
                </span>
                <span className="text-4xl font-black text-cyan-400">
                  {data.accuracy}%
                </span>
              </div>

              <div className="bg-[#121522] border border-amber-500/30 p-5 rounded-2xl flex flex-col items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Star Rating
                </span>
                <span className="text-3xl font-black text-amber-400">
                  {starsString}
                </span>
              </div>
            </div>

            <div className="bg-cyan-950/30 border border-cyan-500/20 p-4 rounded-xl text-xs text-cyan-300 font-medium">
              Keep up the continuous tracking practice to strengthen visual pursuit endurance!
            </div>
          </div>
        )}

        {/* DOCTOR / PARENT DASHBOARD VIEW: Detailed Metrics & Block Trends */}
        {viewTab === 'doctor' && (
          <div className="flex flex-col gap-6 animate-fade-in">
            {/* Top Metric Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#121522] border border-gray-800 p-3 rounded-xl text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Accuracy</span>
                <span className="text-xl font-black text-cyan-400">{data.accuracy}%</span>
              </div>

              <div className="bg-[#121522] border border-gray-800 p-3 rounded-xl text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg Reaction</span>
                <span className="text-xl font-black text-amber-400">{Math.round(data.avgReactionSec * 1000)}ms</span>
              </div>

              <div className="bg-[#121522] border border-gray-800 p-3 rounded-xl text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Avg Error</span>
                <span className="text-xl font-black text-rose-400">{data.avgTrackingErrorPx || 0}px</span>
              </div>

              <div className="bg-[#121522] border border-gray-800 p-3 rounded-xl text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Pattern</span>
                <span className="text-xs font-extrabold text-blue-400 truncate block mt-1">{data.movementPattern}</span>
              </div>
            </div>

            {/* Motion Vector Alignment: Anticipation vs Lag */}
            <div className="bg-[#121522] border border-cyan-500/20 p-4 rounded-2xl">
              <div className="flex justify-between items-center text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">
                <span>Pursuit Vector Alignment</span>
                <span className="text-white font-mono">{data.anticipationVsLagScore}</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Measures whether touch taps lead (anticipation) or trail (lag) the target velocity vector.
              </p>
            </div>

            {/* Block-by-Block Fatigue / Attention Trend */}
            <div>
              <h4 className="text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-3">
                Block Trend (4 Blocks of 5 Trials - Fatigue Analysis)
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {data.blockMetrics && data.blockMetrics.length > 0 ? (
                  data.blockMetrics.map((blk, idx) => (
                    <div
                      key={idx}
                      className="bg-[#121522] border border-gray-800 p-3 rounded-xl flex flex-col items-center text-center"
                    >
                      <span className="text-[10px] font-extrabold text-gray-400 uppercase">
                        Block {blk.blockIndex + 1}
                      </span>
                      <span className="text-lg font-black text-cyan-400 mt-1">
                        {blk.accuracyPercent}%
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono mt-0.5">
                        Err: {blk.avgTrackingErrorPx}px
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-xs text-gray-400 text-center py-2">
                    20 Trials Completed Across 4 Blocks
                  </div>
                )}
              </div>
            </div>

            {/* Clinical Summary Parameters */}
            <div className="bg-[#121522] border border-gray-800 p-3.5 rounded-xl text-xs text-gray-300 grid grid-cols-2 gap-2 font-mono">
              <div>Decoy Density: <strong className="text-white">{data.decoyCount} Decoys</strong></div>
              <div>Pursuit Speed: <strong className="text-white">{data.speedPxPerSec} px/s</strong></div>
              <div>Duration: <strong className="text-white">{data.durationSec}s</strong></div>
              <div>Total Trials: <strong className="text-white">{data.stimuliCount}</strong></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div data-exclude-from-download="true" className="flex flex-col sm:flex-row gap-3 mt-8 relative z-10">
          <button
            onClick={onReplay}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-slate-950 font-extrabold transition-all shadow-lg shadow-cyan-900/30 cursor-pointer"
          >
            Play Again
          </button>

          <button
            onClick={handleExportCSV}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold transition-all cursor-pointer"
          >
            Export CSV
          </button>

          <button
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition-all cursor-pointer"
          >
            Exit Menu
          </button>
        </div>
      </div>
    </div>
  );
};
