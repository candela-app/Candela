import React from 'react';
import {
  RotatoryIcon,
  BeePathIcon,
  TargetIcon,
  PeripheralIcon,
  SearchIcon,
  SlidersIcon,
  AnalyticsIcon,
  MonitorIcon,
  SparklesIcon,
  RocketIcon,
  ArrowRightIcon,
  ArrowDownIcon,
} from '@/components/icons/VectorIcons';
import { GAME_FAMILIES, type TherapyFamilyId } from '@candela/shared';
import logoPng from '@candela/shared/assets/updated_Web logo.png';

const logoSrc = typeof logoPng === 'string' ? logoPng : logoPng.src;

const FAMILY_ICONS: Record<TherapyFamilyId, React.ComponentType<{ className?: string }>> = {
  spin_field: RotatoryIcon,
  tap_timing: TargetIcon,
  look_jumps: PeripheralIcon,
  glimpse_hold: SearchIcon,
  trace_build: BeePathIcon,
};

interface HomePageContentProps {
  onOpenDashboard: () => void;
  onSelectFamily?: (familyId: string) => void;
}

export function HomePageContent({ onOpenDashboard, onSelectFamily }: HomePageContentProps) {
  return (
    <div className="w-full flex-1 flex flex-col bg-[#F4F7FC]">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 text-white py-16 md:py-24 px-6">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider">
            <SparklesIcon className="w-4 h-4 text-blue-400" />
            <span>A Measure of Light, A Measure of Progress</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-white">
            Precision Visual & Cognitive Therapy Tools
          </h1>

          <p className="text-base sm:text-lg text-gray-300 max-w-2xl mx-auto font-medium leading-relaxed">
            Scientifically formulated visual pursuit, ocular motor tracking, and visual discrimination modules designed for clinical accuracy and patient engagement.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={onOpenDashboard}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-base rounded-2xl shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 flex items-center justify-center gap-3 border border-blue-400/30 active:scale-95"
            >
              <RocketIcon className="w-5 h-5" />
              <span>Explore Dashboard</span>
            </button>

            <a
              href="#features"
              className="w-full sm:w-auto px-6 py-4 bg-white/10 hover:bg-white/15 text-white font-semibold text-base rounded-2xl border border-white/20 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>Learn Capabilities</span>
              <ArrowDownIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      {/* QUICK LAUNCH FAMILY PREVIEWS */}
      <section className="max-w-6xl mx-auto px-6 -mt-10 relative z-20 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAME_FAMILIES.map((family) => {
            const Icon = FAMILY_ICONS[family.id];
            const count = family.moduleIds.length;
            return (
              <div
                key={family.id}
                onClick={() => (onSelectFamily ? onSelectFamily(family.id) : onOpenDashboard())}
                className="bg-white rounded-2xl p-5 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-200 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${family.accent}14`, color: family.accent }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">
                    {family.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                    {family.body}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span
                    className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                    style={{
                      color: family.accent,
                      backgroundColor: `${family.accent}14`,
                      borderColor: `${family.accent}33`,
                    }}
                  >
                    {count} {count === 1 ? 'activity' : 'activities'}
                  </span>
                  <div
                    className="text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all"
                    style={{ color: family.accent }}
                  >
                    <span>Open</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* PLACEHOLDER SECTION 1: FEATURES */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20 w-full">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
            Therapy Platform Capabilities
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto text-base">
            Designed for clinical flexibility, custom patient sessions, and detailed performance tracking.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
              <SlidersIcon className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Customizable Parameters</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              Adjust speeds, contrast levels, target sizes, rotation directions, and pattern shapes tailored to specific therapy requirements.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
              <AnalyticsIcon className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Session Analytics</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              Capture detailed timing logs, accuracy scores, round durations, and export CSV reports directly after each exercise session.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-8 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
              <MonitorIcon className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 mb-2">Cross-Platform Ready</h4>
            <p className="text-sm text-gray-600 leading-relaxed">
              Optimized for desktop touch monitors, tablets, and full-screen clinical setups with responsive visual scaling.
            </p>
          </div>
        </div>
      </section>

      {/* PLACEHOLDER SECTION 2: CLINICAL / ABOUT PLACEHOLDER */}
      <section className="bg-white border-y border-gray-200 py-16 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 space-y-4">
            <div className="inline-block px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-md uppercase tracking-wider">
              Content Placeholder
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
              Personalized Rehabilitation Workflows
            </h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              [Placeholder content: Detailed information regarding therapy protocols, patient progress charts, and clinical guidance notes can be placed here.]
            </p>
            <div className="pt-2 flex items-center gap-6">
              <div>
                <span className="block text-2xl font-extrabold text-blue-600">5</span>
                <span className="text-xs text-gray-500 font-medium">Activity Families</span>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <span className="block text-2xl font-extrabold text-blue-600">100%</span>
                <span className="text-xs text-gray-500 font-medium">Configurable Sessions</span>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <span className="block text-2xl font-extrabold text-blue-600">Instant</span>
                <span className="text-xs text-gray-500 font-medium">CSV Export</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-80 h-72 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-800 rounded-2xl shadow-xl flex flex-col items-center justify-center text-white p-6 text-center">
            <div className="mb-3 flex items-center justify-center">
              <img
                src={logoSrc}
                alt="Kandela"
                className="h-10 w-auto object-contain"
              />
            </div>
            <h4 className="font-bold text-xl">Kandela Therapy</h4>
            <p className="text-xs text-blue-100 mt-1">Interactive Vision Exercises</p>
            <button
              onClick={onOpenDashboard}
              className="mt-5 px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 rounded-xl text-xs font-bold shadow transition-colors flex items-center gap-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA FOOTER BANNER */}
      <section className="max-w-6xl mx-auto px-6 py-16 w-full">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-10 text-white text-center shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-extrabold mb-3">
              Ready to start your session?
            </h3>
            <p className="text-blue-100 text-sm md:text-base mb-8">
              Access all vision therapy modules, configure session preferences, and track progress from the main dashboard.
            </p>
            <button
              onClick={onOpenDashboard}
              className="px-8 py-3.5 bg-white text-blue-700 hover:bg-blue-50 font-bold rounded-xl text-base shadow-md transition-all transform hover:scale-105 inline-flex items-center gap-2"
            >
              <span>Open Games Dashboard</span>
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-auto bg-gray-900 text-gray-400 py-8 px-6 text-xs text-center border-t border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-row items-center gap-3">
            <div className="shrink-0 rounded-md bg-white p-0.5">
              <img
                src={logoSrc}
                alt="Kandela"
                className="h-8 w-auto block object-contain"
              />
            </div>
            <span className="text-gray-400 text-xs leading-none mt-1">
              — A Measure of Light, A Measure of Progress
            </span>
          </div>
          <div>
            © {new Date().getFullYear()} Kandela Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
