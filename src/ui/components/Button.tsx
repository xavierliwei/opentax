import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils.ts'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:     'bg-brand text-white hover:bg-blue-900 focus-visible:ring-brand',
        secondary:   'bg-gray-100 text-gray-800 hover:bg-gray-200 focus-visible:ring-gray-400',
        outline:     'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-gray-400',
        ghost:       'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-gray-400',
        destructive: 'text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-400',
        link:        'text-tax-blue underline-offset-4 hover:underline focus-visible:ring-tax-blue',
      },
      size: {
        sm:   'h-9 sm:h-7 px-2.5 text-xs',
        md:   'h-11 sm:h-9 px-4',
        lg:   'h-12 sm:h-10 px-6',
        icon: 'h-9 w-9 sm:h-7 sm:w-7 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
