import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  GAME_CATALOG,
  NO_ACTIVITIES_ASSIGNED_LABEL,
  NO_SESSION_SAVED_LABEL,
  TRUNCATED_HISTORY_NOTE,
  analyticsQueryRange,
  assignmentLevelName,
  formatReportSeconds,
  insightPresetRange,
  isTherapyModuleId,
  resolvedTimeZone,
  type DoctorPrescriptionAnalytics,
  type InsightPreset,
  type PatientPrescriptionPeriod,
  type PatientPrescriptionPractice,
  type PeriodActivity,
  type PrescriptionPeriod,
} from '@candela/shared/rn';
import { getMyPrescriptionPractice, getPatientPrescriptionAnalytics } from '../lib/api';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

type RangeChoice = InsightPreset | 'custom';
type DoctorPractice = DoctorPrescriptionAnalytics & { period?: PrescriptionPeriod };
type PatientPractice = PatientPrescriptionPractice & { period?: PatientPrescriptionPeriod };

function moduleLabel(moduleId: string): string {
  return isTherapyModuleId(moduleId) ? GAME_CATALOG[moduleId].name : moduleId;
}

function formatWhen(iso: string | null, timeZone: string): string {
  if (!iso) return 'No date recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone });
}

function performanceLine(activity: PeriodActivity): string | null {
  if (activity.sessionCount === 0) return null;
  if (activity.performanceLabel == null || activity.performanceValue == null) return 'Performance not available';
  return `${activity.performanceLabel} ${activity.performanceValue}%`;
}

export function PrescriptionPractice({
  audience,
  patientId,
}: {
  audience: 'patient' | 'doctor';
  patientId?: string;
}) {
  const { s, fs } = useLayout();
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<RangeChoice>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [patientPractice, setPatientPractice] = useState<PatientPractice | null>(null);
  const [doctorAnalytics, setDoctorAnalytics] = useState<DoctorPractice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const range = useMemo(() => {
    if (choice === 'custom') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) return null;
      return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
    }
    return insightPresetRange(choice, new Date().toISOString(), timeZone);
  }, [choice, customFrom, customTo, timeZone]);

  useEffect(() => {
    if ((audience === 'doctor' && !patientId) || !range) {
      requestId.current += 1;
      setPatientPractice(null);
      setDoctorAnalytics(null);
      setLoading(false);
      setError('');
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    setPatientPractice(null);
    setDoctorAnalytics(null);
    const query = { ...analyticsQueryRange(range.from, range.to, timeZone), timeZone };
    const request =
      audience === 'doctor' && patientId
        ? getPatientPrescriptionAnalytics(patientId, query)
        : getMyPrescriptionPractice(query);
    request
      .then((result) => {
        if (id !== requestId.current) return;
        if (audience === 'doctor') setDoctorAnalytics(result as DoctorPractice);
        else setPatientPractice(result as PatientPractice);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setPatientPractice(null);
        setDoctorAnalytics(null);
        setError(err instanceof Error ? err.message : 'Could not load assigned activities');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [audience, patientId, range, timeZone]);

  const period = doctorAnalytics?.period;
  const patientPeriod = patientPractice?.period;
  const current = period?.activities.filter((activity) => activity.status === 'current') ?? [];
  const previous = period?.activities.filter((activity) => activity.status === 'no_longer_prescribed') ?? [];
  const text = { fontSize: fs(13), lineHeight: fs(21), color: colors.muted };
  const title = { fontSize: fs(13), fontWeight: '700' as const, color: colors.text };

  function DoctorActivity({ activity }: { activity: PeriodActivity }) {
    const performance = performanceLine(activity);
    const reaction =
      activity.reactionLabel && activity.reactionMeanSec != null
        ? `${activity.reactionLabel} ${formatReportSeconds(activity.reactionMeanSec)}`
        : null;
    return (
      <View style={{ gap: s(4), borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(8) }}>
        <Text style={title}>{activity.moduleName}</Text>
        <Text style={text}>{activity.levelName}</Text>
        <Text style={{ ...text, color: colors.text }}>
          {activity.availability === 'none_saved'
            ? NO_SESSION_SAVED_LABEL
            : `${activity.sessionCount} saved · latest ${formatWhen(activity.lastRecordedAt, timeZone)}`}
        </Text>
        {performance ? <Text style={{ ...text, color: colors.text }}>{performance}</Text> : null}
        {reaction ? <Text style={{ ...text, color: colors.text }}>{reaction}</Text> : null}
        {activity.daily.map((day) => (
          <Text key={day.date} style={text}>
            {day.date}: {day.sessionCount} saved
            {day.performance == null ? ' · Performance not available' : ` · ${day.performance}%`}
          </Text>
        ))}
      </View>
    );
  }

  return (
    <View style={{ gap: s(8), marginBottom: s(21), backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(13) }}>
      <Text style={{ fontSize: fs(21), fontWeight: '700', color: colors.text }}>Assigned activities</Text>
      <Text style={text}>
        Saved sessions in this date range that match an assigned level. The practice record counts every saved session. A missing session is not a missed activity.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
        {(
          [
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['custom', 'Custom'],
          ] as const
        ).map(([id, label]) => {
          const selected = choice === id;
          return (
            <Pressable
              key={id}
              onPress={() => setChoice(id)}
              style={{
                borderRadius: s(13),
                borderWidth: 1,
                borderColor: selected ? colors.blue : colors.border,
                backgroundColor: selected ? colors.blue : colors.white,
                paddingHorizontal: s(13),
                paddingVertical: s(8),
              }}
            >
              <Text style={{ color: selected ? colors.white : colors.text, fontWeight: '700', fontSize: fs(13) }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {choice === 'custom' ? (
        <View style={{ flexDirection: 'row', gap: s(13) }}>
          <TextInput
            value={customFrom}
            onChangeText={setCustomFrom}
            placeholder="From YYYY-MM-DD"
            accessibilityLabel="From date"
            autoCapitalize="none"
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(8), color: colors.text }}
          />
          <TextInput
            value={customTo}
            onChangeText={setCustomTo}
            placeholder="To YYYY-MM-DD"
            accessibilityLabel="To date"
            autoCapitalize="none"
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(8), color: colors.text }}
          />
        </View>
      ) : null}
      {loading ? <Text style={text}>Loading assigned activities…</Text> : null}
      {error ? <Text style={{ color: colors.red, fontSize: fs(13) }}>{error}</Text> : null}
      {patientPeriod?.emptyLabel ? <Text style={text}>{patientPeriod.emptyLabel}</Text> : null}
      {patientPeriod?.modulesWithoutLevels.map((module) => (
        <Text key={module.moduleName} style={text}>
          {module.moduleName}: {module.label}
        </Text>
      ))}
      {patientPeriod?.activities.map((activity) => (
        <View key={`${activity.moduleName}-${activity.levelName}`} style={{ gap: s(4) }}>
          <Text style={title}>{activity.moduleName}</Text>
          <Text style={text}>{activity.levelName}</Text>
          <Text style={{ ...text, color: colors.text }}>
            {activity.availability === 'none_saved' ? NO_SESSION_SAVED_LABEL : `${activity.sessionCount} saved`}
          </Text>
          {activity.lastRecordedAt ? <Text style={text}>Latest {formatWhen(activity.lastRecordedAt, timeZone)}</Text> : null}
        </View>
      ))}
      {patientPeriod?.truncated ? <Text style={text}>{TRUNCATED_HISTORY_NOTE}</Text> : null}
      {period ? <Text style={title}>Current assignment</Text> : null}
      {period && current.length === 0 ? <Text style={text}>{NO_ACTIVITIES_ASSIGNED_LABEL}</Text> : null}
      {current.map((activity) => (
        <DoctorActivity key={`${activity.moduleId}-${activity.levelId}`} activity={activity} />
      ))}
      {previous.length > 0 ? <Text style={title}>No longer prescribed</Text> : null}
      {previous.map((activity) => (
        <DoctorActivity key={`${activity.moduleId}-${activity.levelId}`} activity={activity} />
      ))}
      {period?.modulesWithoutLevels.map((module) => (
        <Text key={module.moduleId} style={text}>
          {module.moduleName}: {module.label}
        </Text>
      ))}
      {period?.truncated ? <Text style={text}>{TRUNCATED_HISTORY_NOTE}</Text> : null}
      {doctorAnalytics ? <Text style={title}>Assignment history</Text> : null}
      {doctorAnalytics?.revisions.length === 0 ? <Text style={text}>No assignment history</Text> : null}
      {doctorAnalytics?.revisions.map((revision) => (
        <Text key={revision.id} style={text}>
          {formatWhen(revision.effectiveFrom, timeZone)}
          {revision.effectiveTo ? ` to ${formatWhen(revision.effectiveTo, timeZone)}` : ' onward'} · {revision.actorLabel}
          {' · '}
          {revision.assignments.length === 0
            ? NO_ACTIVITIES_ASSIGNED_LABEL
            : revision.assignments
                .map((assignment) =>
                  assignment.levels.length === 0
                    ? `${moduleLabel(assignment.moduleId)}: no specific levels assigned`
                    : `${moduleLabel(assignment.moduleId)}: ${assignment.levels.map((levelId) => assignmentLevelName(assignment.moduleId, levelId)).join(', ')}`,
                )
                .join(' · ')}
        </Text>
      ))}
      {(period?.recordedButNotAssigned.length ?? 0) > 0 ? <Text style={title}>Recorded but not assigned</Text> : null}
      {period?.recordedButNotAssigned.map((session) => (
        <Text key={session.id} style={text}>
          {session.levelName} · {formatWhen(session.recordedAt, timeZone)} · {session.label}
          {session.note ? ` ${session.note}` : ''}
        </Text>
      ))}
      {(period?.unattributed.length ?? 0) > 0 ? <Text style={title}>Sessions not linked to an assignment</Text> : null}
      {period?.unattributed.map((session) => (
        <Text key={session.id} style={text}>
          {session.levelName} · {formatWhen(session.recordedAt, timeZone)} · {session.label}
        </Text>
      ))}
    </View>
  );
}
