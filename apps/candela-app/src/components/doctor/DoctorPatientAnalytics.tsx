'use client';

import { PracticeOverview } from '@/components/shared/PracticeOverview';
import { PrescriptionPractice } from '@/components/shared/PrescriptionPractice';
import { SessionAnalyticsPanel } from '@/components/shared/SessionAnalyticsPanel';

export function DoctorPatientAnalytics({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  return (
    <div className="min-w-0 space-y-[21px]">
      <p className="text-[13px] text-gray-500">
        Performance for {patientName} across therapy modules
      </p>
      <PrescriptionPractice audience="doctor" patientId={patientId} />
      <PracticeOverview audience="doctor" patientId={patientId} />
      <SessionAnalyticsPanel patientId={patientId} patientName={patientName} />
    </div>
  );
}
