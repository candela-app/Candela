'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { RecipientSearchItem } from '@candela/shared';
import { XIcon } from '@/components/icons/VectorIcons';

interface RecipientSelectorProps {
  type: 'hospital' | 'user';
  selectedIds: string[];
  onChange: (ids: string[], items: RecipientSearchItem[]) => void;
  placeholder?: string;
}

export function RecipientSelector({
  type,
  selectedIds,
  onChange,
  placeholder,
}: RecipientSelectorProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<RecipientSearchItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<RecipientSearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchInitial() {
      try {
        setLoading(true);
        const res = await api<RecipientSearchItem[]>(
          `/api/super-admin/recipients-search?type=${type}&q=${encodeURIComponent(search)}`,
        );
        if (mounted) {
          setOptions(res);
          // Keep selected items metadata intact
          setSelectedItems((prev) => {
            const map = new Map<string, RecipientSearchItem>();
            prev.forEach((i) => map.set(i.id, i));
            res.forEach((i) => {
              if (selectedIds.includes(i.id)) {
                map.set(i.id, i);
              }
            });
            return selectedIds.map((id) => map.get(id) || { id, label: id, sublabel: '', type });
          });
        }
      } catch (err) {
        console.error('Failed to load recipient options', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timer = setTimeout(fetchInitial, 150);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [type, search, selectedIds]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: RecipientSearchItem) => {
    if (!selectedIds.includes(item.id)) {
      const nextIds = [...selectedIds, item.id];
      const nextItems = [...selectedItems, item];
      setSelectedItems(nextItems);
      onChange(nextIds, nextItems);
    }
    setSearch('');
  };

  const handleRemove = (idToRemove: string) => {
    const nextIds = selectedIds.filter((id) => id !== idToRemove);
    const nextItems = selectedItems.filter((i) => i.id !== idToRemove);
    setSelectedItems(nextItems);
    onChange(nextIds, nextItems);
  };

  const availableOptions = options.filter((opt) => !selectedIds.includes(opt.id));

  return (
    <div className="relative w-full space-y-2" ref={wrapperRef}>
      {/* Selected Chips without icons */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[42px]">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 shadow-2xs"
            >
              <span className="truncate max-w-[200px]">{item.label}</span>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="text-slate-400 hover:text-red-500 rounded p-0.5 transition-colors cursor-pointer"
                title={`Remove ${item.label}`}
              >
                <XIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input Box */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={
            placeholder ||
            (type === 'hospital'
              ? 'Search and select hospitals...'
              : 'Search and select specific users...')
          }
          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-400 transition-all"
        />

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-1 divide-y divide-slate-100">
            {loading && (
              <div className="px-4 py-3 text-xs text-slate-400">Searching options...</div>
            )}
            {!loading && availableOptions.length === 0 && (
              <div className="px-4 py-3 text-xs text-slate-500 text-center">
                {search ? 'No matches found.' : 'All available options are selected.'}
              </div>
            )}
            {!loading &&
              availableOptions.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelect(opt)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50/70 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div className="truncate min-w-0 pr-2">
                    <p className="text-xs font-bold text-slate-800 truncate">{opt.label}</p>
                    {opt.sublabel && (
                      <p className="text-[11px] text-slate-500 truncate">{opt.sublabel}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    + Add
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
