import {Button} from '#/components.js'
import {styler} from '@alinea/styler'
import {IcRoundArrowBack} from '../icons.js'
import css from './EditorBackButton.module.css'

const styles = styler(css)

export interface EditorBackButtonProps {
  label: string
  onPress: () => void
}

export function EditorBackButton({label, onPress}: EditorBackButtonProps) {
  return (
    <Button
      appearance="plain"
      size="icon"
      className={styles.EditorBackButton()}
      aria-label={label}
      onPress={onPress}
      icon={IcRoundArrowBack}
    />
  )
}
