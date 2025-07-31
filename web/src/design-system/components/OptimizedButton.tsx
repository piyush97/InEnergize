// OptimizedButton.tsx - High-performance button component with accessibility
import React, { forwardRef, memo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Button variants using CVA for optimal performance
const buttonVariants = cva(
  // Base styles - optimized for performance
  'inline-flex items-center justify-center rounded-md font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none touch-manipulation will-change-transform active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-primary-500 shadow-sm hover:shadow-md',
        secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 focus-visible:ring-secondary-500 shadow-sm hover:shadow-md',
        outline: 'border border-neutral-300 bg-transparent hover:bg-neutral-50 focus-visible:ring-neutral-500',
        ghost: 'hover:bg-neutral-100 focus-visible:ring-neutral-500',
        destructive: 'bg-danger-500 text-white hover:bg-danger-600 focus-visible:ring-danger-500 shadow-sm hover:shadow-md',
        success: 'bg-success-500 text-white hover:bg-success-600 focus-visible:ring-success-500 shadow-sm hover:shadow-md',
      },
      size: {
        sm: 'h-8 px-3 text-sm gap-1.5',
        md: 'h-10 px-4 text-base gap-2',
        lg: 'h-12 px-6 text-lg gap-2.5',
        xl: 'h-14 px-8 text-xl gap-3',
        icon: 'h-10 w-10',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
    },
  }
);

// Loading spinner sizes
const spinnerSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
  xl: 'h-6 w-6',
  icon: 'h-4 w-4',
};

export interface OptimizedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  as?: 'button' | 'a';
  href?: string;
  external?: boolean;
}

// Memoized button component for optimal re-renders
export const OptimizedButton = memo(
  forwardRef<HTMLButtonElement, OptimizedButtonProps>(
    (
      {
        className,
        variant,
        size,
        fullWidth,
        isLoading = false,
        loadingText,
        leftIcon,
        rightIcon,
        children,
        disabled,
        as = 'button',
        href,
        external,
        ...props
      },
      ref
    ) => {
      // Determine if button should be disabled
      const isDisabled = disabled || isLoading;

      // Button content with loading state
      const content = (
        <>
          {isLoading ? (
            <>
              <Loader2 className={cn(spinnerSizes[size || 'md'], 'animate-spin')} />
              {loadingText && <span>{loadingText}</span>}
            </>
          ) : (
            <>
              {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
              {children}
              {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
            </>
          )}
        </>
      );

      // Render as anchor tag for links
      if (as === 'a' && href) {
        return (
          <a
            href={href}
            className={cn(buttonVariants({ variant, size, fullWidth, className }))}
            target={external ? '_blank' : undefined}
            rel={external ? 'noopener noreferrer' : undefined}
            aria-disabled={isDisabled}
            onClick={isDisabled ? (e) => e.preventDefault() : undefined}
            {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
          >
            {content}
          </a>
        );
      }

      // Default button rendering
      return (
        <button
          ref={ref}
          className={cn(buttonVariants({ variant, size, fullWidth, className }))}
          disabled={isDisabled}
          aria-busy={isLoading}
          aria-disabled={isDisabled}
          {...props}
        >
          {content}
        </button>
      );
    }
  )
);

OptimizedButton.displayName = 'OptimizedButton';

// Icon button variant for common use cases
export const IconButton = memo(
  forwardRef<HTMLButtonElement, Omit<OptimizedButtonProps, 'size'>>(
    ({ className, ...props }, ref) => {
      return (
        <OptimizedButton
          ref={ref}
          size="icon"
          className={cn('rounded-full', className)}
          {...props}
        />
      );
    }
  )
);

IconButton.displayName = 'IconButton';

// Button group component for related actions
export const ButtonGroup = memo(
  ({ children, className }: { children: React.ReactNode; className?: string }) => {
    return (
      <div
        className={cn(
          'inline-flex rounded-md shadow-sm',
          '[&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none',
          '[&>*:not(:first-child):not(:last-child)]:rounded-none',
          '[&>*:not(:last-child)]:border-r-0',
          className
        )}
        role="group"
      >
        {children}
      </div>
    );
  }
);

ButtonGroup.displayName = 'ButtonGroup';

// Export all components and types
export default OptimizedButton;