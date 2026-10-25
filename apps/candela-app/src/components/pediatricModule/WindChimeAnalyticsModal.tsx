'use client';

import React, { useState } from 'react';
import { ChimeSessionAnalytics } from '@candela/shared';
import {
  X,
  Award,
  Activity,
  BarChart3,
  Compass,
  Headphones,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

export interface WindChimeAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayAgain: () => void;
  analytics: ChimeSessionAnalytics;
  patientName?: string;
}

export const WindChimeAnalyticsModal: React.FC<WindChimeAnalyticsModalProps> = ({
  isOpen,
  onClose,
  onPlayAgain,
  analytics,
  patientName = 'Pediatric Patient',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'cadence' | 'motor' | 'bilateral'>('overview');

  if (!isOpen) return null;

  const total = analytics.totalStrikes || 1;
  const gentlePct = Math.round((analytics.gentleCount / total) * 100);
  const modPct = Math.round((analytics.moderateCount / total) * 100);
  const heavyPct = Math.round((analytics.heavyCount / total) * 100);

  const leftPct = Math.round((analytics.leftStrikes / total) * 100);
  const centerPct = Math.round((analytics.centerStrikes / total) * 100);
  const rightPct = Math.round((analytics.rightStrikes / total) * 100);

  // Maximum pace for SVG graph scaling
  const maxPace = Math.max(1, ...analytics.cadenceTimeline.map((c) => c.paceBpm));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Pediatric Sensory & Motor Report</h2>
              <p className="text-xs text-zinc-400">Wind Chime Harmony • {patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Milestone Achievement Banner */}
        <div className="mx-6 mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-sky-500/15 border border-amber-500/30 flex items-center gap-4">
          <div className="text-3xl p-2 rounded-xl bg-zinc-800/80 border border-zinc-700 shadow-inner">
            {analytics.badge.emoji}
          </div>
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-amber-400">Milestone Badge Awarded</div>
            <div className="text-base font-bold text-white">{analytics.badge.title}</div>
            <div className="text-xs text-zinc-300 mt-0.5">{analytics.badge.description}</div>
          </div>
        </div>

        {/* 4 Core KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 mt-4">
          <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Calming Index</span>
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold text-emerald-400">{analytics.sensoryCalmingIndex}%</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Down-regulation level</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Bilateral Balance</span>
              <Compass className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-xl font-bold text-sky-400">{analytics.lateralSymmetryPercent}%</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Left/Right reach symmetry</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Listening Dwell</span>
              <Headphones className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold text-amber-400">{analytics.averageListeningDwellSec}s</div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Avg decay listening pause</div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/60">
            <div className="flex items-center justify-between text-zinc-400 text-xs mb-1">
              <span>Force Grading</span>
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="text-base font-bold text-violet-400 capitalize truncate">
              {analytics.forceModulationGrade.replace('_', ' ')}
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">Proprioceptive control</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-800 px-6 mt-4 gap-2">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'cadence', label: 'Sensory Regulation Curve' },
            { id: 'motor', label: 'Force Modulation' },
            { id: 'bilateral', label: 'Midline & Symmetry' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60 space-y-3">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Clinical Observations</h4>
                <ul className="text-xs text-zinc-300 space-y-2 list-disc list-inside">
                  <li>
                    <strong className="text-white">Sensory Regulation:</strong>{' '}
                    {analytics.sensoryCalmingIndex >= 70
                      ? 'Child exhibited healthy nervous system down-regulation, pacing interactions with increasing calm.'
                      : 'Child maintained high arousal tapping cadence throughout the session.'}
                  </li>
                  <li>
                    <strong className="text-white">Motor Grading:</strong>{' '}
                    {analytics.forceModulationGrade === 'well_graded'
                      ? 'Demonstrated fine force modulation across gentle and moderate strikes without impulsive slamming.'
                      : 'Touch force was skewed toward higher impulses; further proprioceptive grading training advised.'}
                  </li>
                  <li>
                    <strong className="text-white">Spatial Reach:</strong>{' '}
                    {analytics.lateralSymmetryPercent >= 75
                      ? 'Crossed midline and interacted symmetrically with both left and right chime clusters.'
                      : 'Showed unilateral reach preference with hesitation reaching across body midline.'}
                  </li>
                  <li>
                    <strong className="text-white">Causality Mastery:</strong>{' '}
                    Child initiated {analytics.directStrikes} direct tube strikes and {analytics.clapperStrikes} pendulum sail/clapper strikes.
                  </li>
                </ul>
              </div>

              {/* Direct vs Clapper Exploration Breakdown */}
              <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
                <div className="text-xs font-bold text-zinc-200 mb-2">Cause-and-Effect Exploration</div>
                <div className="flex h-3 rounded-full overflow-hidden bg-zinc-700">
                  <div
                    style={{ width: `${(analytics.directStrikes / total) * 100}%` }}
                    className="bg-amber-400"
                    title="Direct Tube Strikes"
                  />
                  <div
                    style={{ width: `${(analytics.clapperStrikes / total) * 100}%` }}
                    className="bg-emerald-400"
                    title="Clapper / Sail Swings"
                  />
                  <div
                    style={{ width: `${(analytics.ambientStrikes / total) * 100}%` }}
                    className="bg-sky-400"
                    title="Ambient Wind Strikes"
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400 mt-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Direct Strikes ({analytics.directStrikes})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Sail/Clapper ({analytics.clapperStrikes})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Ambient ({analytics.ambientStrikes})
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cadence' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Sensory Regulation Curve (Interaction Pace Over Time)
                    </h4>
                    <p className="text-[11px] text-zinc-400">Strikes per minute (BPM) across 10-second intervals</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {analytics.sensoryCalmingIndex >= 70 ? 'Calming Deceleration' : 'Active Arousal'}
                  </span>
                </div>

                {/* SVG Cadence Curve Chart */}
                <div className="w-full h-44 flex items-end gap-1.5 pt-4 pb-2 px-2 bg-zinc-900/60 rounded-xl border border-zinc-800">
                  {analytics.cadenceTimeline.map((item, idx) => {
                    const heightPct = Math.max(8, Math.round((item.paceBpm / maxPace) * 100));
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                        <div className="text-[9px] text-zinc-500 opacity-0 group-hover:opacity-100 transition">
                          {item.paceBpm}
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t transition-all ${
                            idx === 0
                              ? 'bg-amber-500'
                              : idx === analytics.cadenceTimeline.length - 1
                              ? 'bg-emerald-400'
                              : 'bg-zinc-600 group-hover:bg-amber-400/80'
                          }`}
                        />
                        <div className="text-[8px] text-zinc-500">{item.windowStartSec}s</div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400 mt-3 px-1">
                  <span>Start (0s)</span>
                  <span className="text-zinc-500">Timeline</span>
                  <span>End ({analytics.cadenceTimeline[analytics.cadenceTimeline.length - 1]?.windowEndSec ?? 0}s)</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'motor' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-2">
                  Motor Force Grading Distribution
                </h4>
                <p className="text-[11px] text-zinc-400 mb-4">
                  Evaluates proprioceptive control: can the child modulate between soft, moderate, and firm touches?
                </p>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1">
                      <span>🪶 Gentle Touch (&lt; 180 px/s)</span>
                      <span className="text-amber-400 font-bold">{gentlePct}% ({analytics.gentleCount})</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
                      <div style={{ width: `${gentlePct}%` }} className="h-full bg-amber-400 rounded-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1">
                      <span>🍃 Moderate Touch (180 – 420 px/s)</span>
                      <span className="text-emerald-400 font-bold">{modPct}% ({analytics.moderateCount})</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
                      <div style={{ width: `${modPct}%` }} className="h-full bg-emerald-400 rounded-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-zinc-300 mb-1">
                      <span>⚡ Firm / Impulsive (&gt; 420 px/s)</span>
                      <span className="text-rose-400 font-bold">{heavyPct}% ({analytics.heavyCount})</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-zinc-800 overflow-hidden">
                      <div style={{ width: `${heavyPct}%` }} className="h-full bg-rose-400 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bilateral' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-800/40 border border-zinc-700/60">
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider mb-2">
                  Lateral Reach & Midline Crossing
                </h4>
                <p className="text-[11px] text-zinc-400 mb-4">
                  Spatial interaction distribution across Left Chimes, Center Pendulum, and Right Chimes.
                </p>

                <div className="grid grid-cols-3 gap-3 text-center my-4">
                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="text-xs text-zinc-400">Left Chimes</div>
                    <div className="text-xl font-bold text-sky-400 mt-1">{leftPct}%</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{analytics.leftStrikes} strikes</div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="text-xs text-zinc-400">Center Sail</div>
                    <div className="text-xl font-bold text-amber-400 mt-1">{centerPct}%</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{analytics.centerStrikes} strikes</div>
                  </div>

                  <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                    <div className="text-xs text-zinc-400">Right Chimes</div>
                    <div className="text-xl font-bold text-emerald-400 mt-1">{rightPct}%</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{analytics.rightStrikes} strikes</div>
                  </div>
                </div>

                <div className="text-xs text-zinc-300 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <strong className="text-white">Bilateral Symmetry Index: {analytics.lateralSymmetryPercent}%</strong>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {analytics.lateralSymmetryPercent >= 80
                      ? 'High bilateral symmetry: child freely reaches across both hemispaces.'
                      : 'Asymmetric motor reach: consider positioning stimuli on non-preferred side.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/90">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition text-sm font-medium"
          >
            Close Report
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onPlayAgain();
            }}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold transition text-sm shadow-lg shadow-amber-500/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
