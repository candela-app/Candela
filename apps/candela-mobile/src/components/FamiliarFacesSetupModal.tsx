import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
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
} from '@candela/shared/rn';
import { ApiError, deleteFamiliarFace, listFamiliarFaces, updateFamiliarFaceLabel, uploadFamiliarFace } from '../lib/api';
import { useLayout } from '../lib/layout';

export function FamiliarFacesSetupModal({
  isOpen,
  levelId,
  flashMs,
  onFlashMsChange,
  photos,
  onPhotosChange,
  onClose,
}: {
  isOpen: boolean;
  levelId: FamiliarFacesLevelId;
  flashMs: number;
  onFlashMsChange: (value: number) => void;
  photos: FamiliarFacePhoto[];
  onPhotosChange: (photos: FamiliarFacePhoto[]) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
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

  const pickPhoto = async () => {
    const relationLabel = normalizeRelationLabel(label);
    if (!relationLabel) {
      setError('Type who this person is, then choose a photo');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is needed to add family photos');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy(true);
    setError(null);
    try {
      const saved = await uploadFamiliarFace(asset.uri, relationLabel, asset.mimeType, asset.fileName ?? 'photo.jpg');
      onPhotosChange([...photos, saved]);
      setLabel('');
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
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 110,
        backgroundColor: 'rgba(6,7,13,0.98)',
        paddingTop: insets.top + s(8),
        paddingBottom: insets.bottom + s(12),
        paddingHorizontal: s(16),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(12) }}>
        <Text style={{ color: '#fff', fontSize: fs(20), fontWeight: '900' }}>People you know</Text>
        <Pressable
          onPress={onClose}
          style={{
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: '#111827',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#D1D5DB', fontSize: fs(16), fontWeight: '700' }}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: s(16), gap: s(14) }}>
        <Text style={{ color: '#94A3B8', fontSize: fs(13), fontWeight: '600', lineHeight: fs(20) }}>
          Upload photos and type who each person is. Need at least {FAMILIAR_FACES_MIN_PHOTOS} photos to play.
        </Text>

        {levelId === 'flash_match' ? (
          <View>
            <Text style={{ color: '#CBD5E1', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
              PHOTO FLASH
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
              {FAMILIAR_FACES_FLASH_MS_PRESETS.map((ms) => {
                const selected = flashMs === ms;
                return (
                  <Pressable
                    key={ms}
                    onPress={() => onFlashMsChange(clampFamiliarFacesFlashMs(ms))}
                    style={{
                      paddingHorizontal: s(12),
                      paddingVertical: s(8),
                      borderRadius: s(12),
                      borderWidth: 1,
                      backgroundColor: selected ? '#F43F5E' : '#111827',
                      borderColor: selected ? '#FB7185' : '#374151',
                    }}
                  >
                    <Text style={{ color: selected ? '#fff' : '#CBD5E1', fontWeight: '800', fontSize: fs(13) }}>
                      {familiarFacesFlashLabel(ms)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <View>
          <Text style={{ color: '#CBD5E1', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
            WHO IS THIS?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(8) }}>
            {FAMILIAR_FACES_RELATION_PRESETS.map((preset) => {
              const selected = label === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setLabel(preset)}
                  style={{
                    paddingHorizontal: s(12),
                    paddingVertical: s(6),
                    borderRadius: 999,
                    borderWidth: 1,
                    backgroundColor: selected ? '#F43F5E' : '#111827',
                    borderColor: selected ? '#FB7185' : '#374151',
                  }}
                >
                  <Text style={{ color: selected ? '#fff' : '#CBD5E1', fontWeight: '800', fontSize: fs(12) }}>{preset}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Mother, Nani, or any name"
            placeholderTextColor="#64748B"
            maxLength={64}
            style={{
              borderRadius: s(12),
              backgroundColor: '#111827',
              borderWidth: 1,
              borderColor: '#374151',
              color: '#fff',
              paddingHorizontal: s(12),
              paddingVertical: s(12),
              fontSize: fs(14),
              fontWeight: '600',
            }}
          />
        </View>

        <Pressable
          disabled={!canAdd || busy}
          onPress={() => void pickPhoto()}
          style={{
            paddingVertical: s(12),
            borderRadius: s(12),
            backgroundColor: '#34D399',
            opacity: !canAdd || busy ? 0.4 : 1,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#052e1c', fontWeight: '900', fontSize: fs(15) }}>
            {canAdd ? 'Add photo' : `Album full (${FAMILIAR_FACES_MAX_PHOTOS})`}
          </Text>
        </Pressable>

        {error ? <Text style={{ color: '#FDA4AF', fontSize: fs(13), fontWeight: '700' }}>{error}</Text> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(12) }}>
          {photos.map((photo) => (
            <View
              key={photo.id}
              style={{
                width: photos.length === 2 ? '100%' : '47%',
                borderRadius: s(16),
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#1F2937',
                backgroundColor: '#111827',
              }}
            >
              <Image source={{ uri: photo.imageUrl }} style={{ width: '100%', height: s(128) }} />
              <View style={{ padding: s(8), gap: s(8) }}>
                {editingId === photo.id ? (
                  <TextInput
                    value={editingLabel}
                    onChangeText={setEditingLabel}
                    style={{
                      borderRadius: s(8),
                      backgroundColor: '#1F2937',
                      borderWidth: 1,
                      borderColor: '#374151',
                      color: '#fff',
                      paddingHorizontal: s(8),
                      paddingVertical: s(6),
                      fontSize: fs(13),
                    }}
                  />
                ) : (
                  <Text style={{ color: '#fff', fontSize: fs(13), fontWeight: '800' }} numberOfLines={1}>
                    {photo.relationLabel}
                  </Text>
                )}
                <View style={{ flexDirection: 'row', gap: s(8) }}>
                  {editingId === photo.id ? (
                    <Pressable
                      disabled={busy}
                      onPress={() => void handleSaveLabel(photo.id)}
                      style={{ flex: 1, paddingVertical: s(6), borderRadius: s(8), backgroundColor: '#059669', alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(11) }}>Save</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setEditingId(photo.id);
                        setEditingLabel(photo.relationLabel);
                      }}
                      style={{ flex: 1, paddingVertical: s(6), borderRadius: s(8), backgroundColor: '#1F2937', alignItems: 'center' }}
                    >
                      <Text style={{ color: '#E2E8F0', fontWeight: '800', fontSize: fs(11) }}>Rename</Text>
                    </Pressable>
                  )}
                  <Pressable
                    disabled={busy}
                    onPress={() => void handleDelete(photo.id)}
                    style={{ flex: 1, paddingVertical: s(6), borderRadius: s(8), backgroundColor: '#4C0519', alignItems: 'center' }}
                  >
                    <Text style={{ color: '#FECDD3', fontWeight: '800', fontSize: fs(11) }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Pressable
        onPress={onClose}
        style={{
          paddingVertical: s(14),
          borderRadius: 999,
          backgroundColor: '#34D399',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#052e1c', fontWeight: '900', fontSize: fs(16) }}>
          {ready ? 'Done' : `Add ${FAMILIAR_FACES_MIN_PHOTOS - photos.length} more to play`}
        </Text>
      </Pressable>
    </View>
  );
}
