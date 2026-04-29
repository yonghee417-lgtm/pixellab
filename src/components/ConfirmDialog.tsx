import { ReactNode } from 'react';

interface Props {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title, message, confirmLabel = '확인', cancelLabel = '취소', danger, onConfirm, onCancel,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="panel rounded-xl p-6 w-[420px] max-w-[90vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary mb-3">{title}</h3>
        <div className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button
            onClick={onConfirm}
            className={danger ? 'btn bg-red-500 hover:bg-red-600 text-white' : 'btn-primary'}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
