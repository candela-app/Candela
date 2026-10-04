'use client';

import React from 'react';
import { SearchIcon, XIcon } from '@/components/icons/VectorIcons';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  inputClassName = '',
  autoFocus = false,
  disabled = false,
  'aria-label': ariaLabel = 'Search',
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <SearchIcon className="w-4 h-4" />
      </div>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={ariaLabel}
        className={`w-full pl-10 pr-9 py-2 text-sm bg-white border border-gray-200 rounded-xl placeholder:text-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-2xs ${inputClassName}`}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
          title="Clear search"
          aria-label="Clear search input"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
