import styler from '@alinea/styler'
import type {
  ButtonHTMLAttributes,
  PropsWithChildren,
  SelectHTMLAttributes
} from 'react'
import css from './LabControls.module.scss'

const styles = styler(css)

export interface LabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'quiet'
  size?: 'medium' | 'small'
}

export function LabButton({
  variant = 'secondary',
  size = 'medium',
  type = 'button',
  ...props
}: LabButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={styles.LabButton(styler.merge(props), variant, {
        small: size === 'small'
      })}
    />
  )
}

export interface LabSelectProps extends PropsWithChildren<
  SelectHTMLAttributes<HTMLSelectElement>
> {
  label?: string
}

export function LabSelect({label, ...props}: LabSelectProps) {
  const select = (
    <select {...props} className={styles.LabSelect(styler.merge(props))} />
  )
  if (!label) return select
  return (
    <label className={styles.LabSelect.label()}>
      <span>{label}</span>
      {select}
    </label>
  )
}
