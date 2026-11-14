import { cva, type VariantProps } from 'class-variance-authority'
import type { LucideIcon } from 'lucide-react'
import { Slot } from 'radix-ui'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn'
import { Spinner } from './Spinner'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition-colors duration-200 ease-elevate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'border-brand bg-brand text-brand-ink hover:bg-brand-hover hover:border-brand-hover',
        accent:
          'border-accent bg-accent text-accent-ink hover:bg-accent-hover hover:border-accent-hover',
        secondary: 'border-border-strong bg-surface text-ink hover:bg-surface-muted',
        ghost: 'border-transparent bg-transparent text-brand-fg hover:bg-brand-tint',
        danger: 'border-danger bg-danger text-white hover:opacity-90',
        subtle: 'border-transparent bg-surface-muted text-ink hover:bg-surface-sunken',
      },
      size: {
        sm: 'h-9 px-3.5 text-small',
        md: 'h-11 px-4.5 text-body',
        lg: 'h-13 px-5.5 text-body-lg',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & {
    loading?: boolean
    icon?: LucideIcon
    iconRight?: LucideIcon
    /**
     * Render the single child (a `Link`, an `<a>`) with the button's look, instead of a `<button>`.
     * Use it rather than wrapping a `Button` in a link, which gives two tab stops and is invalid HTML.
     */
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  loading,
  icon: Icon,
  iconRight: IconRight,
  children,
  disabled,
  type = 'button',
  asChild,
  ...rest
}: ButtonProps) {
  if (asChild)
    return (
      <Slot.Root className={cn(button({ variant, size }), className)} {...rest}>
        {Icon ? <Icon className="size-[18px]" strokeWidth={2.2} /> : null}
        <Slot.Slottable>{children}</Slot.Slottable>
        {IconRight ? <IconRight className="size-[18px]" strokeWidth={2.2} /> : null}
      </Slot.Root>
    )
  return (
    <button
      type={type}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner className="size-4" />
      ) : Icon ? (
        <Icon className="size-[18px]" strokeWidth={2.2} />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight className="size-[18px]" strokeWidth={2.2} /> : null}
    </button>
  )
}

export { button as buttonVariants }
