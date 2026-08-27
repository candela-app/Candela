import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import type { DocIdRequestResult } from '@candela/shared/rn';
import { FloatingLabelInput } from './FloatingLabelInput';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

export function DocIdRequestCard() {
  const { session, refresh } = useAuth();
  const { fs, s } = useLayout();
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState(false);

  const patient = session?.patient;
  if (!patient) {
    return null;
  }

  const pending = patient.pendingDocIdRequest;
  const linked = Boolean(patient.doctorId && patient.referralCode);

  async function onSubmit() {
    setSaving(true);
    try {
      const result = await api<DocIdRequestResult>('/api/docid/requests', {
        method: 'POST',
        body: JSON.stringify({ referralCode: code.trim().toUpperCase() }),
      });
      setCode('');
      await refresh();
      if (result.recipientRole === 'doctor') {
        Alert.alert(
          'Request sent',
          result.emailSent
            ? `Request sent to the doctor for DocID ${result.targetReferralCode}.`
            : `Request saved for DocID ${result.targetReferralCode}. Ask the doctor to confirm in their dashboard if the email is delayed.`,
        );
      } else {
        Alert.alert(
          'Transfer requested',
          result.emailSent
            ? `Check your email to confirm the transfer to DocID ${result.targetReferralCode}.`
            : 'Request saved. Confirm below if the email is delayed.',
        );
      }
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not submit DocID');
    } finally {
      setSaving(false);
    }
  }

  async function settle(accept: boolean) {
    if (!pending) return;
    setResolving(true);
    try {
      await api(`/api/docid/requests/${pending.id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
      await refresh();
      Alert.alert('Done', accept ? 'Doctor link updated.' : 'Request rejected.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not update request');
    } finally {
      setResolving(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: s(20),
        padding: s(20),
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: fs(11), fontWeight: '600', color: colors.blue, letterSpacing: 0.4 }}>
        DocID
      </Text>
      {linked ? (
        <Text style={{ fontSize: fs(14), color: '#374151', marginTop: s(6) }}>
          Linked to <Text style={{ fontFamily: 'monospace', fontWeight: '800', color: '#1D4ED8' }}>{patient.referralCode}</Text>
        </Text>
      ) : (
        <Text style={{ fontSize: fs(14), color: '#374151', marginTop: s(6) }}>
          You are not linked to a doctor yet. Enter a DocID to request an attach.
        </Text>
      )}
      {patient.previousReferralCodes?.length > 0 ? (
        <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(4) }}>
          Previous: {patient.previousReferralCodes.join(', ')}
        </Text>
      ) : null}

      {pending ? (
        <View style={{ marginTop: s(16) }}>
          <Text style={{ fontSize: fs(14), color: '#4B5563' }}>
            Pending {pending.source === 'self' ? 'attach' : pending.source === 'change' ? 'reassignment' : 'transfer'} to{' '}
            <Text style={{ fontFamily: 'monospace', fontWeight: '800' }}>{pending.targetReferralCode}</Text>
            {pending.targetDoctorName ? ` (Dr. ${pending.targetDoctorName})` : ''}.
          </Text>
          {pending.recipientRole === 'doctor' ? (
            <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(6) }}>
              The doctor must confirm. Check spam if they do not see the email.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(12) }}>
              <Pressable
                onPress={() => void settle(true)}
                disabled={resolving}
                style={{
                  flex: 1,
                  backgroundColor: colors.blue,
                  borderRadius: s(12),
                  paddingVertical: s(12),
                  alignItems: 'center',
                  opacity: resolving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.white, fontWeight: '700' }}>{resolving ? 'Saving…' : 'Confirm'}</Text>
              </Pressable>
              <Pressable
                onPress={() => void settle(false)}
                disabled={resolving}
                style={{
                  flex: 1,
                  backgroundColor: '#F3F4F6',
                  borderRadius: s(12),
                  paddingVertical: s(12),
                  alignItems: 'center',
                  opacity: resolving ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#374151', fontWeight: '600' }}>Reject</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={{ marginTop: s(16), gap: s(10) }}>
          <FloatingLabelInput
            label="DocID"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            style={{ marginBottom: 0 }}
          />
          <Pressable
            onPress={() => void onSubmit()}
            disabled={saving || code.trim().length !== 6}
            style={{
              backgroundColor: colors.blue,
              borderRadius: s(12),
              paddingVertical: s(12),
              alignItems: 'center',
              opacity: saving || code.trim().length !== 6 ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>
              {saving ? 'Sending…' : linked ? 'Request change' : 'Request attach'}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
