'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/lib/toast-context';

interface CopyButtonProps {
  text?: string | null;
  label?: string;
  className?: string;
  iconSize?: number;
  showToast?: boolean;
}

export function CopyButton({
  text,
  label = 'DocID',
  className = '',
  iconSize = 14,
  showToast = true,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  if (!text) {
    return null;
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!text) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      if (showToast) {
        toast.success(`${label} copied to clipboard!`);
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Could not copy ${label}`);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy ${label}`}
      className={`inline-flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors ${className}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check size={iconSize} className="text-emerald-600 transition-transform scale-110" />
      ) : (
        <Copy size={iconSize} />
      )}
    </button>
  );
}
