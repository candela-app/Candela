import React from 'react';
import { MobileTargetSessionResultData, exportSessionCSV } from '@candela/shared';

interface MobileTargetResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestart: () => void;
  onExit?: () => void;
  resultData: MobileTargetSessionResultData | null;
}

export function MobileTargetResultsModal({
  isOpen,
  onClose,
  onRestart,
  onExit,
  resultData,
}: MobileTargetResultsModalProps) {
  if (!isOpen || !resultData) return null;

  const handleExportCSV = () => {
    exportSessionCSV(resultData);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className={`text-2xl ${i < rating ? 'text-amber-400' : 'text-gray-700'}`}
      >
        ★
      </span>
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 select-none">
      <div className="bg-[#121624] border border-gray-800 text-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider">
            Session Completed
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            Mobile Bouncing Pursuit Results
          </h2>
          <div className="flex justify-center gap-1">{renderStars(resultData.starRating)}</div>
          <p className="text-xs text-gray-400">
            Patient: <span className="text-white font-semibold">{resultData.patientName}</span> | Date: {resultData.date}
          </p>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#1A2035] p-3 rounded-2xl border border-gray-800 text-center">
            <span className="block text-2xl font-black text-blue-400">
              {resultData.accuracy}%
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Accuracy</span>
          </div>

          <div className="bg-[#1A2035] p-3 rounded-2xl border border-gray-800 text-center">
            <span className="block text-2xl font-black text-emerald-400">
              {resultData.avgReactionSec.toFixed(2)}s
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Avg Reaction</span>
          </div>

          <div className="bg-[#1A2035] p-3 rounded-2xl border border-gray-800 text-center">
            <span className="block text-2xl font-black text-purple-400">
              {resultData.correct} / {resultData.totalSets}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Correct Sets</span>
          </div>

          <div className="bg-[#1A2035] p-3 rounded-2xl border border-gray-800 text-center">
            <span className="block text-2xl font-black text-rose-400">
              {resultData.wrong}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">Wrong Clicks</span>
          </div>
        </div>

        {/* Set breakdown list */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-gray-300">Set Performance Breakdown</h3>
          <div className="bg-[#1A2035] rounded-2xl p-3 border border-gray-800 max-h-44 overflow-y-auto custom-scrollbar space-y-1.5 text-xs">
            <div className="grid grid-cols-4 font-bold text-gray-400 pb-1 border-b border-gray-700/60 text-center">
              <span>Set</span>
              <span>Target</span>
              <span>Outcome</span>
              <span>Reaction</span>
            </div>
            {resultData.setMetrics.map((metric) => (
              <div
                key={metric.setIndex}
                className="grid grid-cols-4 text-center items-center py-1 border-b border-gray-800/40 last:border-0"
              >
                <span className="font-semibold text-gray-300">#{metric.setIndex + 1}</span>
                <span className="font-bold text-white">{metric.targetValue}</span>
                <span
                  className={`font-semibold capitalize ${
                    metric.outcome === 'correct'
                      ? 'text-emerald-400'
                      : metric.outcome === 'incorrect'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {metric.outcome}
                </span>
                <span className="text-gray-300 font-mono">
                  {metric.outcome === 'timeout'
                    ? 'Timeout'
                    : `${(metric.reactionTimeMs / 1000).toFixed(2)}s`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div
          data-exclude-from-download="true"
          className="flex flex-col sm:flex-row gap-3 pt-2 relative z-10"
        >
          <button
            onClick={onRestart}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center cursor-pointer text-sm"
          >
            Play Again
          </button>

          <button
            onClick={handleExportCSV}
            className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold transition-all flex items-center justify-center cursor-pointer text-sm"
          >
            Export CSV
          </button>

          <button
            onClick={onExit || onClose}
            className="py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition-all flex items-center justify-center cursor-pointer shadow-sm shadow-red-950/20 text-sm"
          >
            Exit to Menu
          </button>
        </div>
      </div>
    </div>
  );
}
