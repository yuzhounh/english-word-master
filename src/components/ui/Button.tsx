import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'gradient-brand text-white shadow-sm hover:opacity-95 active:scale-[0.98] disabled:opacity-50',
  secondary:
    'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-50',
  ghost:
    'text-slate-600 hover:text-brand-600 hover:bg-brand-50 active:scale-[0.98] disabled:opacity-50',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-sm gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) => (
  <button
    className={`inline-flex items-center justify-center font-semibold rounded-[var(--radius-button)] transition-all cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    {...props}
  >
    {children}
  </button>
);
