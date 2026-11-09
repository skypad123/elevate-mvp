import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '../lib/cn'

const fieldBase =
  'w-full rounded-control border border-border-strong bg-surface px-3.5 text-body text-ink placeholder:text-ink-tertiary transition-colors focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 disabled:bg-surface-muted disabled:text-ink-tertiary aria-invalid:border-danger aria-invalid:focus:ring-danger/25'

export type FieldProps = {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  children: (id: string, describedBy: string | undefined) => ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={id} className="text-small-strong font-semibold text-ink-secondary">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
      ) : null}
      {children(id, [hintId, errorId].filter(Boolean).join(' ') || undefined)}
      {error ? (
        <p id={errorId} className="text-small text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-small text-ink-tertiary">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  wrapperClassName?: string
}

export function Input({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  required,
  ...rest
}: InputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(fieldBase, 'h-11', className)}
          {...rest}
        />
      )}
    </Field>
  )
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  wrapperClassName?: string
}

export function Textarea({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  required,
  rows = 5,
  ...rest
}: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(id, describedBy) => (
        <textarea
          id={id}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(fieldBase, 'py-2.5 leading-6', className)}
          {...rest}
        />
      )}
    </Field>
  )
}

export type NativeSelectProps = InputHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  wrapperClassName?: string
  children: ReactNode
}

export function NativeSelect({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  required,
  children,
  ...rest
}: NativeSelectProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {(id, describedBy) => (
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          required={required}
          className={cn(
            fieldBase,
            'h-11 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23575B57%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>")] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  )
}

export { fieldBase }
