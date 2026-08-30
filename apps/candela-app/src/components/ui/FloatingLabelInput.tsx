'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/icons/VectorIcons';

export type FloatingLabelVariant = 'light' | 'dark';

type FloatingLabelInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  variant?: FloatingLabelVariant;
  error?: string;
  id?: string;
  className?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  name?: string;
  /** Extra padding on the right (e.g. for password toggle). */
  endAdornment?: ReactNode;
  autoFocus?: boolean;
};

const shellByVariant: Record<
  FloatingLabelVariant,
  { wrap: string; input: string; labelIdle: string; labelActive: string }
> = {
  light: {
    wrap: 'border-shell-border bg-white focus-within:border-shell-blue focus-within:ring-2 focus-within:ring-shell-blue/20',
    input: 'text-shell-text',
    labelIdle: 'text-shell-muted',
    labelActive: 'text-shell-blue',
  },
  dark: {
    wrap: 'border-gray-700 bg-[#141414] focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20',
    input: 'text-white',
    labelIdle: 'text-gray-400',
    labelActive: 'text-amber-400',
  },
};

function isWebkitAutofilled(el: HTMLInputElement): boolean {
  try {
    return el.matches(':-webkit-autofill');
  } catch {
    return false;
  }
}

export function FloatingLabelInput({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  variant = 'light',
  error,
  id: idProp,
  className = '',
  inputMode,
  disabled,
  required,
  minLength,
  maxLength,
  name,
  endAdornment,
  autoFocus,
}: FloatingLabelInputProps) {
  const genId = useId();
  const id = idProp ?? genId;
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [focused, setFocused] = useState(false);
  const [autofilled, setAutofilled] = useState(false);

  const floated = focused || value.length > 0 || autofilled;
  const theme = shellByVariant[variant];
  const notchBg = variant === 'dark' ? '#141414' : '#ffffff';

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const syncFromDom = () => {
      const auto = isWebkitAutofilled(el);
      const domValue = el.value;
      if (auto || domValue) {
        setAutofilled(true);
        if (domValue) onChangeRef.current(domValue);
      } else {
        setAutofilled(false);
      }
    };

    syncFromDom();
    const timers = [50, 100, 250, 500, 1000].map((ms) => window.setTimeout(syncFromDom, ms));

    const onAnimStart = (e: Event) => {
      if ((e as globalThis.AnimationEvent).animationName === 'floatingLabelAutofill') {
        setAutofilled(true);
        if (el.value) onChangeRef.current(el.value);
      }
    };

    el.addEventListener('animationstart', onAnimStart);
    return () => {
      timers.forEach(clearTimeout);
      el.removeEventListener('animationstart', onAnimStart);
    };
  }, []);

  const pushValue = (next: string) => {
    onChange(next);
    if (!next && inputRef.current && !isWebkitAutofilled(inputRef.current)) {
      setAutofilled(false);
    } else if (next) {
      setAutofilled(true);
    }
  };

  return (
    <div className={className}>
      <div className={`relative floating-label-field ${disabled ? 'opacity-60' : ''}`}>
        <div
          className={`relative rounded-xl border transition-all ${theme.wrap} ${
            error ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-rose-500/20' : ''
          }`}
        >
          <input
            ref={inputRef}
            id={id}
            name={name}
            type={type}
            value={value}
            autoComplete={autoComplete}
            inputMode={inputMode}
            disabled={disabled}
            required={required}
            minLength={minLength}
            maxLength={maxLength}
            placeholder=" "
            autoFocus={autoFocus}
            onChange={(e) => pushValue(e.target.value)}
            onInput={(e) => pushValue((e.target as HTMLInputElement).value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              const el = inputRef.current;
              if (el && (el.value || isWebkitAutofilled(el))) setAutofilled(true);
            }}
            className={`floating-label-input peer w-full bg-transparent outline-none text-sm font-medium px-4 py-3.5 ${
              endAdornment ? 'pr-12' : ''
            } ${variant === 'dark' ? 'floating-label-input--dark' : ''} ${theme.input}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {endAdornment ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-[1]">{endAdornment}</div>
          ) : null}
        </div>
        <label
          htmlFor={id}
          style={floated ? { backgroundColor: notchBg } : undefined}
          className={`floating-label-notch pointer-events-none absolute left-3 z-10 transition-all duration-150 ${
            floated
              ? `top-0 -translate-y-1/2 px-1.5 text-[11px] font-semibold tracking-wide ${theme.labelActive}`
              : `top-1/2 -translate-y-1/2 px-1 text-sm font-semibold ${theme.labelIdle}`
          }`}
        >
          {label}
        </label>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FloatingLabelPasswordInput({
  label,
  value,
  onChange,
  autoComplete,
  variant = 'light',
  error,
  id,
  className = '',
  disabled,
  required,
  minLength,
}: Omit<FloatingLabelInputProps, 'type' | 'endAdornment' | 'inputMode'>) {
  const [visible, setVisible] = useState(false);
  const iconClass =
    variant === 'dark'
      ? 'text-gray-400 hover:text-white'
      : 'text-shell-muted hover:text-shell-text';

  return (
    <FloatingLabelInput
      label={label}
      value={value}
      onChange={onChange}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      variant={variant}
      error={error}
      id={id}
      className={className}
      disabled={disabled}
      required={required}
      minLength={minLength}
      endAdornment={
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setVisible((v) => !v);
          }}
          className={`p-1 ${iconClass}`}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
        </button>
      }
    />
  );
}
