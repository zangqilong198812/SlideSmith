import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'secondary' | 'ghost' | 'danger-ghost';
type Size = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon: ReactNode;
  label: string;
}

const base =
  'inline-flex items-center justify-center rounded-lg ' +
  'border transition-colors shrink-0 ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  secondary:
    'bg-transparent text-ink-4 border-line hover:bg-raised hover:text-ink-2 hover:border-line-2 ' +
    'focus-visible:ring-ink/15',
  ghost:
    'bg-transparent text-ink-5 border-transparent hover:bg-raised hover:text-ink-2 ' +
    'focus-visible:ring-ink/10',
  'danger-ghost':
    'bg-transparent text-ink-5 border-transparent hover:bg-raised hover:text-red-600 ' +
    'focus-visible:ring-red-500/20',
};

const sizes: Record<Size, string> = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
};

export function IconButton({
  variant = 'ghost',
  size = 'md',
  icon,
  label,
  className = '',
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}
