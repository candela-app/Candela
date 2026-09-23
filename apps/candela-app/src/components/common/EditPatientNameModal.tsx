'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { api, ApiError } from '@/lib/api';
import type { SessionUser } from '@candela/shared';
import { CloseIcon, PencilIcon } from '@/components/icons/VectorIcons';

export interface EditPatientNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  isWelcome?: boolean;
}

export function EditPatientNameModal({
  isOpen,
  onClose,
  isWelcome = false,
}: EditPatientNameModalProps) {
  const { session, applySession } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && session?.user?.name) {
      setName(session.user.name);
      setError('');
    }
  }, [isOpen, session?.user?.name]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a valid patient name.');
      return;
    }

    // If unchanged and in welcome mode, simply close
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

  function handleSkip() {
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="patient-name-title"
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isWelcome) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-3xl border border-shell-border shadow-2xl max-w-md w-full p-6 sm:p-7 relative flex flex-col">
        {!isWelcome && (
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-shell-blue flex-shrink-0">
            <PencilIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 id="patient-name-title" className="text-xl font-bold text-shell-text">
              {isWelcome ? 'Welcome! Who is playing?' : 'Change Patient Name'}
            </h2>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-5 leading-relaxed">
          {isWelcome
            ? `Signed in as ${session?.user?.name || 'Google User'}. If this account is for a child, parent, or family member, enter their name below so games and progress reports are personalized.`
            : 'Update the patient display name shown across games, therapies, and clinical reports.'}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="patient-name-input" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
              Patient / Player Name
            </label>
            <input
              id="patient-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Grandma Mary or Alice"
              maxLength={100}
              autoFocus
              disabled={submitting}
              className="w-full px-4 py-3 rounded-xl border border-shell-border focus:border-shell-blue focus:ring-2 focus:ring-shell-blue/20 outline-none text-base font-medium text-shell-text transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-3 mt-2">
            {isWelcome ? (
              <button
                type="button"
                onClick={handleSkip}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Keep &quot;{session?.user?.name || 'Default'}&quot;
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-5 py-2.5 rounded-xl text-sm font-bold bg-shell-blue text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/10 transition-all cursor-pointer"
            >
              {submitting ? 'Saving…' : isWelcome ? 'Save & Continue' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
