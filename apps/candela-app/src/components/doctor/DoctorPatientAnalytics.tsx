'use client';

import { AnalyticsIcon } from '@/components/icons/VectorIcons';
import { SessionAnalyticsPanel } from '@/components/shared/SessionAnalyticsPanel';

export function DoctorPatientAnalytics({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  return (
    <div className="space-y-5 min-w-0">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-blue-600 flex items-center justify-center shrink-0">
          <AnalyticsIcon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] text-gray-500 font-medium break-words">
            Performance for {patientName} across therapy modules
          </p>
        </div>
      </div>
      <SessionAnalyticsPanel patientId={patientId} patientName={patientName} />
    </div>
  );
}
