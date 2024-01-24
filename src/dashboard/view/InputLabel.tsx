import {Icon, fromModule, px} from 'alinea/ui'
import {Chip} from 'alinea/ui/Chip'
import {HStack} from 'alinea/ui/Stack'
import {IcOutlineLock} from 'alinea/ui/icons/IcOutlineLock'
import {PhGlobe} from 'alinea/ui/icons/PhGlobe'
import {ComponentType, PropsWithChildren, forwardRef, memo} from 'react'
import css from './InputLabel.module.scss'

const styles = fromModule(css)

export type LabelHeaderProps = {
  label: string
  help?: string
  size?: 'small' | 'medium' | 'large'
  focused?: boolean
  icon?: ComponentType
  shared?: boolean
  readOnly?: boolean
  optional?: boolean
  error?: boolean | string
}

export const LabelHeader = memo(function LabelHeader({
  label,
  help,
  size,
  focused,
  // icon: Icon,
  shared,
  readOnly,
  optional,
  error
}: LabelHeaderProps) {
  return (
    <header className={styles.header(size, {focused, error: Boolean(error)})}>
      <HStack center wrap gap={`${px(4)} ${px(8)}`}>
        <HStack center gap={8} className={styles.header.title()}>
          {/*Icon && <Icon />*/}
          <span>{label}</span>
        </HStack>
        {readOnly && (
          <Icon title="Read-only" icon={IcOutlineLock} style={{opacity: 0.6}} />
        )}
        {shared && <Chip icon={PhGlobe}>Shared</Chip>}
        {optional && <Chip>Optional</Chip>}
        {help && <div className={styles.header.help()}>{help}</div>}
        {typeof error === 'string' && (
          <div className={styles.header.help()}>{error}</div>
        )}
      </HStack>
    </header>
  )
})

export interface LabelProps extends PropsWithChildren {
  label?: string
  asLabel?: boolean
  help?: string
  optional?: boolean
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
}

/** Label for an input */
export const InputLabel = forwardRef<HTMLElement, LabelProps>(
  function InputLabel(
    {
      children,
      label,
      asLabel,
      help,
      optional,
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
      required
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
              optional={optional}
              size={size}
              focused={focused}
              icon={icon}
              shared={shared}
              readOnly={readOnly}
              error={error}
            />
          )}
          <div className={styles.root.inner.content()}>{children}</div>
        </div>
      </Tag>
    )
  }
)
