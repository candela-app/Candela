'use client';

import { AnalyticsIcon } from '@/components/icons/VectorIcons';

function EmptyChartCard({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-bold text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
      <div className="mt-4 h-40 rounded-xl bg-gray-50 border border-dashed border-gray-200 relative overflow-hidden">
        <div className="absolute inset-x-6 bottom-8 top-6 border-l border-b border-gray-200" />
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-xs font-semibold text-gray-400">No sessions yet</p>
        </div>
      </div>
    </div>
  );
}

export function DoctorPatientAnalytics({ patientName }: { patientName: string }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-blue-600 flex items-center justify-center">
          <AnalyticsIcon className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-[20px] font-extrabold text-gray-900 tracking-tight">Session Analytics</h2>
          <p className="text-[13px] text-gray-500 font-medium">
            Performance for {patientName} across therapy modules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EmptyChartCard
          title="Accuracy over time"
          hint="Session accuracy will plot here after play is saved"
        />
        <EmptyChartCard
          title="Sessions by family"
          hint="Counts per family will appear here after play is saved"
        />
      </div>
    </div>
  );
}
