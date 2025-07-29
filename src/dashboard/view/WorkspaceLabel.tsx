import styler from '@alinea/styler'
import {HStack, Icon, TextLabel} from 'alinea/ui'
import {LogoShape} from 'alinea/ui/branding/LogoShape'
import {contrastColor} from 'alinea/ui/util/ContrastColor'
import type {ComponentType} from 'react'
import {AlineaLogo} from './AlineaLogo.js'
import css from './WorkspaceLabel.module.scss'

const styles = styler(css)

export type WorkspaceLabelProps = {
  color?: string
  label: string
  icon?: ComponentType
}

export function WorkspaceLabel({label, color, icon}: WorkspaceLabelProps) {
  return (
    <HStack center gap={8} className={styles.root()}>
      <div className={styles.root.logo()}>
        <LogoShape foreground={contrastColor(color)} background={color}>
          <Icon icon={icon ?? <AlineaLogo />} />
        </LogoShape>
      </div>
      <div className={styles.root.label()}>
        <TextLabel label={label} />
      </div>
    </HStack>
  )
}
