import {HStack, Icon, fromModule} from 'alinea/ui'
import {Lift} from 'alinea/ui/Lift'
import {ComponentType, PropsWithChildren, ReactNode} from 'react'
import css from './EntryNotice.module.scss'

const styles = fromModule(css)

export interface EntryNoticeProps {
  icon?: ComponentType
  title: ReactNode
  variant: 'draft' | 'published' | 'archived' | 'transition' | 'untranslated'
}

export function EntryNotice({
  icon,
  title,
  variant,
  children
}: PropsWithChildren<EntryNoticeProps>) {
  return (
    <Lift className={styles.root(variant)}>
      <HStack center gap={22}>
        {icon && (
          <div>
            <Icon icon={icon} size={24} />
          </div>
        )}
        <div>
          <h2 className={styles.root.title()}>{title}</h2>
          {children}
        </div>
      </HStack>
    </Lift>
  )
}
