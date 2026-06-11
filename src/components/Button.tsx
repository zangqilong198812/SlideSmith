import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger-ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ' +
  'border transition-colors select-none whitespace-nowrap ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-offset-0 ' +
  'disabled:opacity-50 disabled:pointer-events-none';

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-bg border-ink hover:bg-ink-hover hover:border-ink-hover ' +
    'focus-visible:ring-ink/30',
  secondary:
    'bg-transparent text-ink-3 border-line hover:bg-raised hover:text-ink-2 hover:border-line-2 ' +
    'focus-visible:ring-ink/15',
  ghost:
    'bg-transparent text-ink-4 border-transparent hover:bg-raised hover:text-ink-2 ' +
    'focus-visible:ring-ink/10',
  'danger-ghost':
    'bg-transparent text-ink-4 border-transparent hover:bg-raised hover:text-red-600 ' +
    'focus-visible:ring-red-500/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-[11px]',
  md: 'h-8 px-3 text-[12px]',
  lg: 'h-9 px-3.5 text-[13px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  trailingIcon,
  fullWidth,
  children,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
      {trailingIcon}
    </button>
  );
}
