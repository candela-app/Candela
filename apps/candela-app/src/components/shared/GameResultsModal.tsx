'use client';

import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { SessionResultData, exportSessionCSV } from '@candela/shared';

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

  if (!isOpen) return null;

  const handleExportCSV = () => {
    exportSessionCSV(data);
  };

  const handleDownloadCardImage = async () => {
    if (!cardRef.current) return;
    try {
      const gameSlug = data.gameName
        ? data.gameName.toLowerCase().replace(/\s+/g, '-')
        : 'results';
      const fileName = `game-session-completed-${gameSlug}.png`;

      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
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

      // Detect mobile phone screen width (< 768px with touch)
      const isMobilePhone =
        typeof window !== 'undefined' &&
        window.innerWidth < 768 &&
        ('ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

      // On mobile phones, try Web Share API first so user can "Save to Photos"
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
        } catch (shareErr) {
          if ((shareErr as Error)?.name === 'AbortError') return;
        }
      }

      // Universal Direct File Download for Desktop, Laptops, Tablets & Mobile
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
      <div
        ref={cardRef}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#121212] p-6 sm:p-8 text-white shadow-2xl shadow-emerald-900/20"
      >
        {/* Glow Background Accents */}
        <div className="absolute -top-24 -left-24 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        {/* Top-Right Download Card Button - No Border */}
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
        </div>

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

          {/* Avg Reaction Time */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
              Avg Reaction
            </span>
            <span className="text-2xl font-black text-amber-400">
              {Math.round(data.avgReactionSec * 1000)}ms
            </span>
          </div>

          {/* Stimuli / Popped */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
              Bubbles Popped
            </span>
            <span className="text-2xl font-black text-purple-400">
              {data.stimuliCount}
            </span>
          </div>

          {/* Visual Focus Score (Dummy Metric) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
              Visual Focus Score
            </span>
            <span className="text-2xl font-black text-cyan-400">96 / 100</span>
          </div>

          {/* Processing Speed Tier (Dummy Metric) */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col items-center text-center">
            <span className="text-xs uppercase tracking-wider font-semibold text-gray-400 mb-1">
              Processing Speed
            </span>
            <span className="text-2xl font-black text-green-400">Optimal</span>
          </div>
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
