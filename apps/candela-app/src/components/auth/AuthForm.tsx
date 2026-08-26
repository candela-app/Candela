'use client';

import Link from 'next/link';
import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/icons/VectorIcons';
import logoPng from '@candela/shared/assets/updated_Web logo.png';

const logoSrc = typeof logoPng === 'string' ? logoPng : (logoPng as any).src;

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <Link href="/" className="mb-6 flex items-center hover:opacity-80 transition-opacity">
          <img src={logoSrc} alt="Kandela" className="h-12 w-auto object-contain" />
        </Link>
        <div className="w-full max-w-[420px] bg-white rounded-3xl border border-shell-border p-8 shadow-sm">
          <h1 className="text-2xl font-extrabold text-shell-text tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-shell-muted mt-2 mb-6">{subtitle}</p> : <div className="mb-6" />}
          {children}
        </div>
      </main>
    </div>
  );
}

export function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-shell-text mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-shell-border px-4 py-3 text-sm font-medium text-shell-text outline-none focus:border-shell-blue focus:ring-2 focus:ring-shell-blue/20"
      />
    </label>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block mb-4">
      <span className="block text-sm font-semibold text-shell-text mb-1.5">{label}</span>
      <span className="relative block">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-shell-border px-4 py-3 pr-12 text-sm font-medium text-shell-text outline-none focus:border-shell-blue focus:ring-2 focus:ring-shell-blue/20"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setVisible((v) => !v);
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-shell-muted hover:text-shell-text"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
        </button>
      </span>
    </label>
  );
}

export function PrimaryButton({
  children,
  disabled,
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full mt-2 px-6 py-3 bg-shell-blue hover:bg-blue-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
    >
      {children}
    </button>
  );
}
