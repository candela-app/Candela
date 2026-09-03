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
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-blue-600 flex items-center justify-center">
          <AnalyticsIcon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[13px] text-gray-500 font-medium">
            Performance for {patientName} across therapy modules
          </p>
        </div>
      </div>
      <SessionAnalyticsPanel patientId={patientId} patientName={patientName} />
    </div>
  );
}
