import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingClasses = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6 sm:p-8',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  padding = 'md',
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-[var(--radius-card)] border border-slate-200/80 shadow-card ${paddingClasses[padding]} ${
      hover || onClick ? 'hover:shadow-card-hover hover:border-brand-200 transition-all cursor-pointer' : ''
    } ${className}`}
  >
    {children}
  </div>
);
