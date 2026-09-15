import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PopoverProps {
  button: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top';
  width?: number;
}

export function Popover({
  button,
  children,
  align = 'left',
  placement = 'bottom',
  width = 220,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((o) => !o)}>{button}</div>
      {open && (
        <div
          className={`panel ts-fade-up absolute z-40 overflow-hidden rounded-xl p-1.5 ${
            placement === 'top' ? 'bottom-full mb-2' : 'mt-2'
          }`}
          style={{
            [align === 'left' ? 'left' : 'right']: 0,
            minWidth: width,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors"
      style={{ color: danger ? '#dc2626' : 'var(--text)' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 7%, transparent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
