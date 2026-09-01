'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  FAMILIAR_FACES_FLASH_MS_PRESETS,
  FAMILIAR_FACES_MAX_PHOTOS,
  FAMILIAR_FACES_MIN_PHOTOS,
  FAMILIAR_FACES_RELATION_PRESETS,
  clampFamiliarFacesFlashMs,
  familiarFacesFlashLabel,
  normalizeRelationLabel,
  type FamiliarFacePhoto,
  type FamiliarFacesLevelId,
} from '@candela/shared';
import { ApiError, deleteFamiliarFace, listFamiliarFaces, updateFamiliarFaceLabel, uploadFamiliarFace } from '@/lib/api';

interface FamiliarFacesSetupModalProps {
  isOpen: boolean;
  levelId: FamiliarFacesLevelId;
  flashMs: number;
  onFlashMsChange: (value: number) => void;
  photos: FamiliarFacePhoto[];
  onPhotosChange: (photos: FamiliarFacePhoto[]) => void;
  onClose: () => void;
}

export function FamiliarFacesSetupModal({
  isOpen,
  levelId,
  flashMs,
  onFlashMsChange,
  photos,
  onPhotosChange,
  onClose,
}: FamiliarFacesSetupModalProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError(null);
    void listFamiliarFaces()
      .then((rows) => {
        if (!cancelled) onPhotosChange(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load photos');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, onPhotosChange]);

  if (!isOpen) return null;

  const canAdd = photos.length < FAMILIAR_FACES_MAX_PHOTOS;
  const ready = photos.length >= FAMILIAR_FACES_MIN_PHOTOS;

  const handleFiles = async (file: File | undefined) => {
    const relationLabel = normalizeRelationLabel(label);
    if (!file) return;
    if (!relationLabel) {
      setError('Type who this person is, then choose a photo');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await uploadFamiliarFace(file, relationLabel);
      onPhotosChange([...photos, saved]);
      setLabel('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not upload that photo');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await deleteFamiliarFace(id);
      onPhotosChange(photos.filter((photo) => photo.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that photo');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLabel = async (id: string) => {
    const next = normalizeRelationLabel(editingLabel);
    if (!next) {
      setError('Relation cannot be empty');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await updateFamiliarFaceLabel(id, next);
      onPhotosChange(photos.map((photo) => (photo.id === id ? saved : photo)));
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the name');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-[#06070D]/98 flex flex-col px-4 py-4 sm:px-8 text-left select-none">
      <div className="flex items-center justify-between max-w-lg w-full mx-auto mb-3">
        <h2 className="text-white text-xl font-black">People you know</h2>
        <button
          type="button"
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-gray-900/70 border border-gray-700/80 text-gray-300 hover:text-white"
          aria-label="Close album setup"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto max-w-lg w-full mx-auto pb-4 space-y-4">
        <p className="text-slate-400 text-sm font-semibold leading-relaxed">
          Upload photos and type who each person is. Need at least {FAMILIAR_FACES_MIN_PHOTOS} photos to play.
        </p>

        {levelId === 'flash_match' ? (
          <div>
            <p className="text-slate-300 text-xs font-extrabold tracking-wider uppercase mb-2">Photo flash</p>
            <div className="flex flex-wrap gap-2">
              {FAMILIAR_FACES_FLASH_MS_PRESETS.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => onFlashMsChange(clampFamiliarFacesFlashMs(ms))}
                  className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                    flashMs === ms
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-gray-900 text-slate-300 border-gray-700'
                  }`}
                >
                  {familiarFacesFlashLabel(ms)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-slate-300 text-xs font-extrabold tracking-wider uppercase mb-2">Who is this?</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {FAMILIAR_FACES_RELATION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setLabel(preset)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                  label === preset
                    ? 'bg-rose-500 text-white border-rose-400'
                    : 'bg-gray-900 text-slate-300 border-gray-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Mother, Nani, or any name"
            maxLength={64}
            className="w-full rounded-xl bg-gray-900 border border-gray-700 text-white px-3 py-3 text-sm font-semibold"
          />
        </div>

        <button
          type="button"
          disabled={!canAdd || busy}
          onClick={() => fileRef.current?.click()}
          className="w-full py-3 rounded-xl bg-[#34D399] text-slate-950 font-black disabled:opacity-40"
        >
          {canAdd ? 'Add photo' : `Album full (${FAMILIAR_FACES_MAX_PHOTOS})`}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files?.[0])}
        />

        {error ? <p className="text-rose-300 text-sm font-semibold">{error}</p> : null}

        <div className={`grid gap-3 ${photos.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-2xl overflow-hidden border border-gray-800 bg-gray-900">
              <img
                src={photo.imageUrl}
                alt={photo.relationLabel}
                className={`w-full object-cover ${photos.length === 2 ? 'h-48 sm:h-32' : 'h-32'}`}
              />
              <div className="p-2 space-y-2">
                {editingId === photo.id ? (
                  <input
                    value={editingLabel}
                    onChange={(event) => setEditingLabel(event.target.value)}
                    className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white px-2 py-1 text-sm"
                  />
                ) : (
                  <p className="text-white text-sm font-bold truncate">{photo.relationLabel}</p>
                )}
                <div className="flex gap-2">
                  {editingId === photo.id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSaveLabel(photo.id)}
                      className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-emerald-600 text-white"
                    >
                      Save
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(photo.id);
                        setEditingLabel(photo.relationLabel);
                      }}
                      className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-gray-800 text-slate-200"
                    >
                      Rename
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(photo.id)}
                    className="flex-1 text-xs font-bold py-1.5 rounded-lg bg-rose-950 text-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full max-w-lg mx-auto py-4 rounded-full bg-[#34D399] text-slate-950 font-black text-lg"
      >
        {ready ? 'Done' : `Add ${FAMILIAR_FACES_MIN_PHOTOS - photos.length} more to play`}
      </button>
    </div>
  );
}
