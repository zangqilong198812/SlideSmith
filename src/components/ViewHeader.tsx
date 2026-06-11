import type { ReactNode } from 'react';

interface ViewHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

export function ViewHeader({ title, subtitle, right }: ViewHeaderProps) {
  return (
    <div className="px-8 py-5 border-b border-line flex items-start justify-between gap-4 shrink-0">
      <div>
        <h1 className="text-[18px] font-semibold text-ink leading-tight">{title}</h1>
        {subtitle && (
          <p className="text-[13px] text-ink-5 mt-1">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
