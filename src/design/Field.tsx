import styler from '@alinea/styler'
import {useId} from 'react'
import type {InputHTMLAttributes} from 'react'
import css from './Field.module.css'

const styles = styler(css)

export interface FieldProps {
  defaultValue?: string
  description?: string
  disabled?: boolean
  error?: string
  label: string
  multiline?: boolean
  optional?: boolean
  placeholder?: string
  rows?: number
  type?: InputHTMLAttributes<HTMLInputElement>['type']
}

export function Field({
  defaultValue,
  description,
  disabled,
  error,
  label,
  multiline,
  optional,
  placeholder,
  rows = 4,
  type = 'text'
}: FieldProps) {
  const id = useId()
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ')
  const inputProps = {
    'aria-describedby': describedBy || undefined,
    'aria-invalid': Boolean(error),
    className: styles['alinea-Field-input'](),
    defaultValue,
    disabled,
    id,
    placeholder
  }

  return (
    <div
      className={styles['alinea-Field']()}
      data-disabled={disabled ? '' : undefined}
      data-invalid={error ? '' : undefined}
    >
      <div className={styles['alinea-Field-heading']()}>
        <label className={styles['alinea-Field-label']()} htmlFor={id}>
          {label}
        </label>
        {description && (
          <span
            className={styles['alinea-Field-description']()}
            id={descriptionId}
          >
            {description}
          </span>
        )}
        {optional && (
          <span className={styles['alinea-Field-optional']()}>Optional</span>
        )}
      </div>
      <div className={styles['alinea-Field-control']()}>
        {multiline ? (
          <textarea {...inputProps} rows={rows} />
        ) : (
          <input {...inputProps} type={type} />
        )}
      </div>
      {error && (
        <p className={styles['alinea-Field-error']()} id={errorId}>
          {error}
        </p>
      )}
    </div>
  )
}
