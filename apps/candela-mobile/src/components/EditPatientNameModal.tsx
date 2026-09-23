import { useState, useEffect } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../lib/toast-context';
import { api, ApiError } from '../lib/api';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';
import { CloseIcon, PencilIcon } from './icons';
import type { SessionUser } from '@candela/shared/rn';

export function EditPatientNameModal({
  visible,
  onClose,
  isWelcome = false,
}: {
  visible: boolean;
  onClose: () => void;
  isWelcome?: boolean;
}) {
  const { s, fs } = useLayout();
  const { session, applySession } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && session?.user?.name) {
      setName(session.user.name);
      setError('');
    }
  }, [visible, session?.user?.name]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a valid patient name.');
      return;
    }

    if (isWelcome && trimmed === session?.user?.name?.trim()) {
      onClose();
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const updated = await api<SessionUser>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      });
      applySession(updated);
      toast.success(isWelcome ? `Welcome, ${trimmed}!` : 'Patient name updated successfully.');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to update patient name.';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isWelcome && !submitting) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          paddingHorizontal: s(20),
        }}
      >
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: s(24),
            padding: s(24),
            borderWidth: 1,
            borderColor: '#E5E7EB',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 8,
          }}
        >
          {!isWelcome && (
            <Pressable
              onPress={onClose}
              disabled={submitting}
              hitSlop={s(10)}
              style={{
                position: 'absolute',
                top: s(16),
                right: s(16),
                padding: s(4),
                borderRadius: s(10),
              }}
            >
              <CloseIcon size={s(20)} color="#9CA3AF" />
            </Pressable>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), marginBottom: s(12) }}>
            <View
              style={{
                width: s(40),
                height: s(40),
                borderRadius: s(14),
                backgroundColor: '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#DBEAFE',
              }}
            >
              <PencilIcon size={s(18)} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(18), fontWeight: '800', color: '#111827' }}>
                {isWelcome ? 'Welcome! Who is playing?' : 'Change Patient Name'}
              </Text>
            </View>
          </View>

          <Text
            style={{
              fontSize: fs(13),
              color: '#4B5563',
              lineHeight: fs(18),
              marginBottom: s(18),
            }}
          >
            {isWelcome
              ? `Signed in as ${session?.user?.name || 'Google User'}. If this account is for a family member or child, enter their name below so therapies and progress reports are personalized.`
              : 'Update the patient display name shown across games, therapies, and clinical reports.'}
          </Text>

          {error ? (
            <View
              style={{
                padding: s(10),
                borderRadius: s(12),
                backgroundColor: '#FEF2F2',
                borderWidth: 1,
                borderColor: '#FECACA',
                marginBottom: s(14),
              }}
            >
              <Text style={{ fontSize: fs(12), color: '#DC2626', fontWeight: '600' }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ marginBottom: s(20) }}>
            <Text
              style={{
                fontSize: fs(11),
                fontWeight: '700',
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                marginBottom: s(6),
              }}
            >
              Patient / Player Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Grandma Mary or Alice"
              placeholderTextColor="#9CA3AF"
              maxLength={100}
              autoFocus
              editable={!submitting}
              style={{
                borderWidth: 1.5,
                borderColor: '#E5E7EB',
                borderRadius: s(14),
                paddingHorizontal: s(14),
                paddingVertical: s(12),
                fontSize: fs(15),
                color: '#111827',
                backgroundColor: '#F9FAFB',
              }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: s(10), justifyContent: 'flex-end' }}>
            {isWelcome ? (
              <Pressable
                onPress={onClose}
                disabled={submitting}
                style={{
                  paddingVertical: s(12),
                  paddingHorizontal: s(14),
                  borderRadius: s(12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: fs(13), fontWeight: '700', color: '#6B7280' }}>
                  Keep &quot;{session?.user?.name || 'Default'}&quot;
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onClose}
                disabled={submitting}
                style={{
                  paddingVertical: s(12),
                  paddingHorizontal: s(16),
                  borderRadius: s(12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: fs(13), fontWeight: '700', color: '#6B7280' }}>Cancel</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              disabled={submitting || !name.trim()}
              style={{
                backgroundColor: colors.blue,
                paddingVertical: s(12),
                paddingHorizontal: s(20),
                borderRadius: s(12),
                alignItems: 'center',
                justifyContent: 'center',
                opacity: submitting || !name.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={{ fontSize: fs(13), fontWeight: '800', color: '#FFFFFF' }}>
                  {isWelcome ? 'Save & Continue' : 'Save Changes'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
