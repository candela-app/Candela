'use client';

import Link from 'next/link';
import logoPng from '@candela/shared/assets/updated_Web logo.png';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '@/components/ui/FloatingLabelInput';

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
    <FloatingLabelInput
      label={label}
      type={type}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      variant="light"
      className="mb-4"
    />
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
  return (
    <FloatingLabelPasswordInput
      label={label}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      variant="light"
      className="mb-4"
    />
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
