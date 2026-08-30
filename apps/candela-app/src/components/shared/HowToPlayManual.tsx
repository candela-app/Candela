'use client';

import React from 'react';
import { getHowToPlay, type HowToPlayMode, type TherapyModuleId } from '@candela/shared';

function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-40 sm:h-44 rounded-2xl bg-[#0B1220] border border-gray-800 flex items-center justify-center overflow-hidden">
      {children}
    </div>
  );
}

function HowToPlayVisual({ moduleId }: { moduleId: TherapyModuleId }) {
  switch (moduleId) {
    case 'rotatory':
      return (
        <VisualFrame>
          <div className="relative w-[128px] h-[128px] rounded-full bg-gray-900 border-[6px] border-sky-950 flex items-center justify-center">
            {[
              { className: 'left-1/2 -top-1 -translate-x-1/2', label: 'A', color: 'bg-emerald-400' },
              { className: '-right-1 top-1/2 -translate-y-1/2', label: 'B', color: 'bg-sky-400' },
              { className: 'left-1/2 -bottom-1 -translate-x-1/2', label: 'C', color: 'bg-amber-400' },
              { className: '-left-1 top-1/2 -translate-y-1/2', label: 'D', color: 'bg-pink-400' },
            ].map((b) => (
              <div
                key={b.label}
                className={`absolute ${b.className} w-8 h-8 rounded-full ${b.color} text-slate-950 font-black text-sm flex items-center justify-center`}
              >
                {b.label}
              </div>
            ))}
            <div className="w-9 h-9 rounded-full bg-emerald-400 text-slate-950 font-black flex items-center justify-center">A</div>
          </div>
        </VisualFrame>
      );
    case 'sorting':
      return (
        <VisualFrame>
          <div className="flex items-end gap-3">
            {['1', '2', '3'].map((n, i) => (
              <div key={n} className="flex flex-col items-center gap-1">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center font-black text-lg ${
                    i === 0 ? 'bg-emerald-400 text-slate-950' : 'bg-gray-800 text-gray-200 border-2 border-gray-700'
                  }`}
                >
                  {n}
                </div>
                <span className="h-4 text-[10px] font-extrabold text-slate-500">{i === 0 ? 'NEXT' : ''}</span>
              </div>
            ))}
          </div>
        </VisualFrame>
      );
    case 'bee_tracing':
      return (
        <VisualFrame>
          <svg width="220" height="120" viewBox="0 0 220 120" aria-hidden>
            <path d="M18 92 C 50 20, 90 20, 110 60 S 170 110, 202 36" stroke="#334155" strokeWidth="10" fill="none" strokeLinecap="round" />
            <path d="M18 92 C 50 20, 90 20, 110 60 S 170 110, 202 36" stroke="#34D399" strokeWidth="3" fill="none" strokeDasharray="6 7" strokeLinecap="round" />
            <circle cx="110" cy="60" r="14" fill="#FBBF24" />
            <circle cx="106" cy="56" r="2.5" fill="#111827" />
            <circle cx="114" cy="56" r="2.5" fill="#111827" />
          </svg>
        </VisualFrame>
      );
    case 'pursuit':
      return (
        <VisualFrame>
          <div className="relative w-[86%] h-[90px]">
            <div className="absolute left-[8%] top-7 w-7 h-7 rounded-full bg-gray-800" />
            <div className="absolute left-[42%] top-12 w-5 h-5 rounded-full bg-gray-700" />
            <div className="absolute left-[68%] top-4 w-10 h-10 rounded-full bg-cyan-400 border-[3px] border-cyan-50" />
          </div>
        </VisualFrame>
      );
    case 'mobile_target':
      return (
        <VisualFrame>
          <div className="relative w-[88%] h-[100px]">
            <div className="absolute left-[12%] top-9 w-11 h-11 rounded-full bg-gray-800 text-gray-400 font-black flex items-center justify-center">
              B
            </div>
            <div className="absolute right-[16%] top-4 w-[52px] h-[52px] rounded-full bg-emerald-400 text-slate-950 font-black text-lg flex items-center justify-center">
              A
            </div>
          </div>
        </VisualFrame>
      );
    case 'geoboard':
      return (
        <VisualFrame>
          <svg width="150" height="130" viewBox="0 0 150 130" aria-hidden>
            {[0, 1, 2, 3].flatMap((row) =>
              [0, 1, 2, 3].map((col) => (
                <circle key={`${row}-${col}`} cx={24 + col * 34} cy={22 + row * 30} r="4" fill="#64748B" />
              )),
            )}
            <path d="M24 22 L92 22 L92 82 L24 82 Z" stroke="#34D399" strokeWidth="3" fill="none" />
          </svg>
        </VisualFrame>
      );
    case 'peripheral_view':
      return (
        <VisualFrame>
          <div className="w-[90%] h-[110px] flex items-center justify-between">
            <div className="w-9 h-9 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center justify-center">A</div>
            <div className="w-4 h-4 rounded-full border-[3px] border-sky-400" />
            <div className="w-9 h-9 rounded-lg bg-sky-400 text-slate-950 font-black flex items-center justify-center">B</div>
          </div>
        </VisualFrame>
      );
    case 'number_search':
      return (
        <VisualFrame>
          <div className="flex flex-wrap w-40 gap-1.5 justify-center">
            {['K', '3', 'M', 'R', 'P', '7', 'W', 'Q', '2'].map((ch) => {
              const digit = /\d/.test(ch);
              return (
                <div
                  key={ch}
                  className={`w-9 h-9 rounded-lg font-extrabold flex items-center justify-center ${
                    digit ? 'bg-emerald-400 text-slate-950' : 'bg-gray-800 text-slate-400'
                  }`}
                >
                  {ch}
                </div>
              );
            })}
          </div>
        </VisualFrame>
      );
    case 'pattern_match':
      return (
        <VisualFrame>
          <div className="flex flex-col items-center gap-2.5">
            <div className="bg-gray-900 border-2 border-emerald-400 rounded-xl px-3.5 py-2 text-emerald-400 font-black tracking-[0.3em] text-base">
              A7F
            </div>
            <div className="flex gap-2">
              {['A7F', 'A9F', 'A7E'].map((code, i) => (
                <div
                  key={code}
                  className={`px-2 py-1.5 rounded-lg text-xs font-extrabold ${
                    i === 0 ? 'bg-emerald-900 text-emerald-300 border border-emerald-400' : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {code}
                </div>
              ))}
            </div>
          </div>
        </VisualFrame>
      );
    case 'location_memory':
      return (
        <VisualFrame>
          <div className="flex flex-wrap w-[132px] gap-2">
            {['1', '', '3', '', '2', ''].map((n, i) => (
              <div
                key={i}
                className={`w-[38px] h-[38px] rounded-lg font-black text-white flex items-center justify-center ${
                  n ? 'bg-blue-700' : 'bg-gray-800'
                }`}
              >
                {n}
              </div>
            ))}
          </div>
        </VisualFrame>
      );
    case 'direction_sense':
      return (
        <VisualFrame>
          <div className="flex items-center gap-5">
            <div className="flex flex-col items-center gap-1">
              <span className="text-white font-black text-3xl">F</span>
              <span className="text-emerald-400 font-extrabold text-lg">↻</span>
            </div>
            <span className="text-slate-500 font-black text-xl">→</span>
            <span className="text-emerald-400 font-black text-3xl rotate-90">F</span>
          </div>
        </VisualFrame>
      );
    default:
      return null;
  }
}

export function HowToPlayManual({
  moduleId,
  isOpen,
  mode = 'entry',
  onContinue,
  onClose,
}: {
  moduleId: TherapyModuleId;
  isOpen: boolean;
  mode?: HowToPlayMode;
  onContinue: () => void;
  onClose?: () => void;
}) {
  if (!isOpen) return null;
  const guide = getHowToPlay(moduleId);
  const isReview = mode === 'review';

  return (
    <div className="fixed inset-0 z-[120] bg-[#06070D]/98 flex flex-col px-5 py-4 sm:px-8 text-left select-none">
      {isReview ? (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-gray-900/70 border border-gray-700/80 text-gray-300 hover:text-white flex items-center justify-center"
          aria-label="Close how to play"
        >
          ✕
        </button>
      ) : null}

      <div className={`flex-1 overflow-y-auto flex flex-col justify-center max-w-lg w-full mx-auto pb-4 ${isReview ? 'pt-14' : 'pt-6'}`}>
        <p className="text-slate-400 font-extrabold text-xs tracking-[0.16em] mb-1.5">HOW TO PLAY</p>
        <h2 className="text-white text-2xl sm:text-3xl font-black mb-1.5">{guide.title}</h2>
        <p className="text-gray-400 font-semibold text-sm leading-relaxed mb-4">{guide.subtitle}</p>
        <HowToPlayVisual moduleId={moduleId} />
        <ol className="mt-5 space-y-3">
          {guide.steps.map((step, i) => {
            const isClap = i === guide.steps.length - 1;
            return (
            <li key={step.title} className="flex gap-3">
              <span
                className={`shrink-0 w-7 h-7 rounded-full font-black text-sm flex items-center justify-center ${
                  isClap ? 'bg-amber-400 text-slate-950' : 'bg-emerald-900 text-emerald-300'
                }`}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-slate-50 font-extrabold">{step.title}</p>
                <p className="text-slate-400 text-sm leading-relaxed">{step.body}</p>
              </div>
            </li>
            );
          })}
        </ol>
      </div>

      {isReview ? null : (
        <button
          type="button"
          onClick={onContinue}
          className="w-full max-w-lg mx-auto mb-2 py-4 rounded-full bg-[#34D399] text-slate-950 font-black text-lg active:scale-[0.98]"
        >
          Continue to settings
        </button>
      )}
    </div>
  );
}
