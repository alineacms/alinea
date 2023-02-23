import {Label, renderLabel} from 'alinea/core/Label'
import {fromModule} from 'alinea/ui'
import {Chip} from 'alinea/ui/Chip'
import {HStack} from 'alinea/ui/Stack'
import {ComponentType, forwardRef, memo, PropsWithChildren} from 'react'
import css from './InputLabel.module.scss'

const styles = fromModule(css)

export type LabelHeaderProps = {
  label: Label
  help?: Label
  optional?: boolean
  size?: 'small' | 'medium' | 'large'
  focused?: boolean
  icon?: ComponentType
}

export const LabelHeader = memo(function LabelHeader({
  label,
  optional,
  help,
  size,
  focused,
  icon: Icon
}: LabelHeaderProps) {
  return (
    <header className={styles.header(size, {focused})}>
      <HStack center wrap gap={8}>
        <HStack center gap={8} className={styles.header.title()}>
          {/*Icon && <Icon />*/}
          <span>{renderLabel(label)}</span>
        </HStack>
        {optional && <Chip>Optional</Chip>}
        {help && (
          <div className={styles.header.help()}>{renderLabel(help)}</div>
        )}
      </HStack>
    </header>
  )
})

export type LabelProps = PropsWithChildren<{
  label: Label
  asLabel?: boolean
  help?: Label
  optional?: boolean
  width?: number
  inline?: boolean
  collection?: boolean
  focused?: boolean
  size?: 'small' | 'medium' | 'large'
  icon?: ComponentType
  empty?: boolean
}>

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
      empty
    },
    ref
  ) {
    const Tag = asLabel ? 'label' : 'div'
    return (
      <Tag
        className={styles.root({collection, inline, focused, empty})}
        style={{width: `${width * 100}%`}}
        ref={ref as any}
      >
        <div className={styles.root.inner()}>
          {!inline && (
            <div className={styles.root.header()}>
              <LabelHeader
                label={label}
                help={help}
                optional={optional}
                size={size}
                focused={focused}
                icon={icon}
              />
            </div>
          )}
          {children}
        </div>
      </Tag>
    )
  }
)
