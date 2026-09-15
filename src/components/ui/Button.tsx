import React, { ButtonHTMLAttributes } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Spinner } from './Spinner';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'warning' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth = false, isLoading = false, loadingText, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-action-primary text-white hover:bg-action-primary-hover active:bg-primary-900',
      secondary: 'bg-action-secondary text-action-secondary-text hover:bg-action-secondary-hover',
      destructive: 'bg-action-destructive text-white hover:bg-action-destructive-hover',
      warning: 'bg-action-warning text-white hover:bg-action-warning-hover',
      ghost: 'bg-transparent text-action-ghost-text hover:bg-action-ghost-hover',
      gold: 'bg-gold-500 text-neutral-900 font-bold hover:bg-gold-400 shadow-gold hover:shadow-[0_0_24px_rgba(201,168,76,0.50)]',
    };

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-5 text-base',
      lg: 'h-12 px-6 text-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth ? 'w-full' : '',
          className
        )}
        {...props}
      >
        {isLoading && (
          <Spinner 
            size="sm" 
            variant={variant === 'secondary' || variant === 'ghost' ? 'primary' : 'white'} 
            className="mr-2" 
          />
        )}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
