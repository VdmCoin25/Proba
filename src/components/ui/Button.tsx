import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent/90 active:bg-accent/80 shadow-soft disabled:bg-ink-soft/30 dark:bg-accent-dark dark:hover:bg-accent-dark/90',
  secondary:
    'bg-ink text-white hover:bg-ink/85 active:bg-ink/75 dark:bg-white dark:text-ink dark:hover:bg-white/85',
  outline:
    'border border-line bg-transparent text-ink hover:border-ink/30 hover:bg-black/[0.02] dark:border-line-dark dark:text-ink-dark dark:hover:border-white/20 dark:hover:bg-white/[0.03]',
  ghost:
    'bg-transparent text-ink hover:bg-black/[0.04] dark:text-ink-dark dark:hover:bg-white/[0.06]',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-14 px-7 text-base gap-2.5 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', icon, iconRight, fullWidth, className = '', children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...props}
      >
        {icon}
        {children}
        {iconRight}
      </button>
    );
  },
);
Button.displayName = 'Button';
