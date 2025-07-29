import styler from '@alinea/styler'
import {Icon, px} from 'alinea/ui'
import {Chip} from 'alinea/ui/Chip'
import {IcOutlineLock} from 'alinea/ui/icons/IcOutlineLock'
import {IcRoundUnfoldLess} from 'alinea/ui/icons/IcRoundUnfoldLess'
import {IcRoundUnfoldMore} from 'alinea/ui/icons/IcRoundUnfoldMore'
import {PhGlobe} from 'alinea/ui/icons/PhGlobe'
import {HStack} from 'alinea/ui/Stack'
import {
  type ComponentType,
  forwardRef,
  memo,
  type PropsWithChildren,
  type ReactNode
} from 'react'
import {IconButton} from './IconButton.js'
import css from './InputLabel.module.scss'

const styles = styler(css)

export type LabelHeaderProps = {
  label: ReactNode
  help?: ReactNode
  size?: 'small' | 'medium' | 'large'
  focused?: boolean
  icon?: ComponentType
  shared?: boolean
  readOnly?: boolean
  required?: boolean
  error?: boolean | string
  isFolded?: boolean
  toggleFold?: () => void
}

export const LabelHeader = memo(function LabelHeader({
  label,
  help,
  size,
  focused,
  // icon: Icon,
  shared,
  readOnly,
  required,
  error,
  isFolded,
  toggleFold
}: LabelHeaderProps) {
  const showError = typeof error === 'string'
  return (
    <header className={styles.header(size, {focused, error: Boolean(error)})}>
      <HStack center wrap gap={`${px(4)} ${px(8)}`}>
        <HStack center gap={8} className={styles.header.title()}>
          {/*Icon && <Icon />*/}
          <span>
            {label}
            {required && ' *'}
          </span>
        </HStack>
        {readOnly && (
          <Icon title="Read-only" icon={IcOutlineLock} style={{opacity: 0.6}} />
        )}
        {shared && <Chip icon={PhGlobe}>Shared</Chip>}
        {showError ? (
          <div className={styles.header.help({error: true})}>{error}</div>
        ) : (
          help && <div className={styles.header.help()}>{help}</div>
        )}
        {isFolded !== undefined && (
          <IconButton
            disabled={!toggleFold}
            title={isFolded ? 'Expand' : 'Fold'}
            icon={isFolded ? IcRoundUnfoldMore : IcRoundUnfoldLess}
            size={14}
            onClick={toggleFold}
          />
        )}
      </HStack>
    </header>
  )
})

export interface InputLabelProps extends PropsWithChildren {
  label?: ReactNode
  asLabel?: boolean
  help?: ReactNode
  width?: number
  inline?: boolean
  collection?: boolean
  focused?: boolean
  size?: 'small' | 'medium' | 'large'
  icon?: ComponentType
  empty?: boolean
  shared?: boolean
  readOnly?: boolean
  className?: string
  error?: boolean | string
  required?: boolean
  isFolded?: boolean
  toggleFold?: () => void
}

/** Label for an input */
export const InputLabel = forwardRef<HTMLElement, InputLabelProps>(
  function InputLabel(
    {
      children,
      label,
      asLabel,
      help,
      width = 1,
      inline = false,
      collection = false,
      focused = false,
      size,
      icon,
      empty,
      shared,
      readOnly,
      className,
      error,
      required,
      isFolded,
      toggleFold
    },
    ref
  ) {
    const Tag = asLabel ? 'label' : 'div'
    return (
      <Tag
        className={styles.root.with(className)({
          collection,
          inline,
          focused,
          empty,
          readOnly
        })}
        style={{width: `${width * 100}%`}}
        ref={ref as any}
      >
        <div className={styles.root.inner()}>
          {!inline && label && (
            <LabelHeader
              label={label}
              help={help}
              required={required}
              size={size}
              focused={focused}
              icon={icon}
              shared={shared}
              readOnly={readOnly}
              error={error}
              isFolded={isFolded}
              toggleFold={toggleFold}
            />
          )}
          <div className={styles.root.inner.content()}>{children}</div>
        </div>
      </Tag>
    )
  }
)
