import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover',
        secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700',
        outline: 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-transparent dark:text-slate-100 dark:hover:bg-slate-800',
        destructive: 'bg-red-600 text-white hover:bg-red-700',
        ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white',
        danger: 'text-red-600 hover:bg-red-50 disabled:opacity-100 disabled:text-red-600 disabled:hover:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40 dark:disabled:text-red-400 dark:disabled:hover:bg-transparent',
      },
      size: {
        default: 'h-9 px-3.5',
        sm: 'h-8 px-2.5 text-xs',
        lg: 'h-11 px-5',
        icon: 'size-8 shrink-0 p-0',
        'icon-sm': 'size-7 shrink-0 p-0',
        'icon-xs': 'size-6 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
