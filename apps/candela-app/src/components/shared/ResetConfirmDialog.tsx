'use client';

export function ResetConfirmDialog({
  isOpen,
  onCancel,
  onConfirm,
  title = 'Reset this game?',
  message = 'This session will start over, and the current progress will be lost.',
  cancelLabel = 'Keep playing',
  confirmLabel = 'Reset',
}: {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-[#1A1A1A] text-white rounded-2xl border border-gray-700 max-w-md w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-extrabold mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-[#222] border border-gray-700 text-gray-200 font-semibold hover:bg-gray-800 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-extrabold cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
