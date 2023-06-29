import {Label} from 'alinea/core'
import {HStack, Icon, TextLabel, fromModule} from 'alinea/ui'
import {LogoShape} from 'alinea/ui/branding/LogoShape'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {contrastColor} from 'alinea/ui/util/ContrastColor'
import {ComponentType} from 'react'
import css from './WorkspaceLabel.module.scss'

const styles = fromModule(css)

export type WorkspaceLabelProps = {
  color?: string
  label: Label
  icon?: ComponentType
}

export function WorkspaceLabel({label, color, icon}: WorkspaceLabelProps) {
  return (
    <HStack center gap={8} className={styles.root()}>
      <div className={styles.root.logo()}>
        <LogoShape foreground={contrastColor(color)} background={color}>
          <Icon icon={icon ?? RiFlashlightFill} />
        </LogoShape>
      </div>
      <div className={styles.root.label()}>
        <TextLabel label={label} />
      </div>
    </HStack>
  )
}
