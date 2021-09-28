import {fromModule} from '@alinea/ui'
import {Chip} from '@alinea/ui/Chip'
import {HStack} from '@alinea/ui/Stack'
import {memo, PropsWithChildren, ReactNode} from 'react'
import css from './InputLabel.module.scss'

const styles = fromModule(css)

type LabelHeaderProps = {
  label: ReactNode
  help?: ReactNode
  optional?: boolean
}

const LabelHeader = memo(function LabelHeader({
  label,
  optional,
  help
}: LabelHeaderProps) {
  return (
    <header className={styles.header.title()}>
      <HStack center gap={8}>
        <span>{label}</span>
        {optional && <Chip>Optional</Chip>}
      </HStack>
      {help && <div className={styles.header.title.help()}>{help}</div>}
    </header>
  )
})

export type LabelProps = PropsWithChildren<{
  label: ReactNode
  help?: ReactNode
  visible?: boolean
  optional?: boolean
}>

export function Label({
  children,
  label,
  help,
  optional,
  visible = true
}: LabelProps) {
  if (!visible) return <>{children}</>
  return (
    <div className={styles.root()}>
      <LabelHeader label={label} help={help} optional={optional} />
      {children}
    </div>
  )
}
