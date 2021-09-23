import {Chip} from '@alinea/ui/Chip'
import {HStack} from '@alinea/ui/Stack'
import {fromModule} from '@alinea/ui/styler'
import {memo, PropsWithChildren, ReactNode} from 'react'
import css from './InputLabel.module.scss'

const styles = fromModule(css)

export type InputLabelProps = PropsWithChildren<{
  label: ReactNode
  help?: ReactNode
  visible?: boolean
  optional?: boolean
}>

export const InputLabel = memo<InputLabelProps>(function InputLabel({
  children,
  label,
  help,
  optional,
  visible = true
}) {
  if (!visible) return <>{children}</>
  return (
    <div className={styles.root()}>
      <header className={styles.root.title()}>
        <HStack>
          {label} {optional && <Chip mod="secondary">Optioneel</Chip>}
        </HStack>
        {help && <div className={styles.root.title.help()}>{help}</div>}
      </header>

      {children}
    </div>
  )
})
