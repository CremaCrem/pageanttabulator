import React, { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'gold' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-primary-800 text-white hover:bg-primary-700 hover:-translate-y-[1px] hover:shadow-green active:translate-y-0 active:bg-primary-900',
      gold: 'bg-gold-500 text-neutral-900 font-bold hover:bg-gold-400 shadow-gold hover:shadow-[0_0_24px_rgba(201,168,76,0.50)]',
      outline: 'border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50',
      ghost: 'bg-transparent text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900',
    };

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-5 text-base',
      lg: 'h-12 px-6 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth ? 'w-full' : '',
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
