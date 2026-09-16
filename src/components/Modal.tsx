import { useEffect, type ReactNode } from 'react';
import { IconX } from './icons';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, title, onClose, children, width = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-[3vh] md:p-6 md:pt-[10vh]"
      style={{ background: 'rgba(9,9,11,0.42)', backdropFilter: 'blur(3px)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel ts-fade-up flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl md:max-h-[76vh]"
        style={{ maxWidth: width, boxShadow: 'var(--shadow-lg)' }}
      >
        <div
          className="flex shrink-0 items-center justify-between px-4 py-3 md:px-5 md:py-3.5"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
          <button className="btn btn-ghost -mr-1 px-2" onClick={onClose} aria-label="关闭">
            <IconX />
          </button>
        </div>
        <div className="ts-scroll overflow-y-auto px-4 py-3.5 md:px-5 md:py-4">{children}</div>
      </div>
    </div>
  );
}
