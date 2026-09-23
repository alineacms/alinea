import {PageBack} from '#/components.js'

export interface EditorBackButtonProps {
  label: string
  onPress: () => void
}

export function EditorBackButton({label, onPress}: EditorBackButtonProps) {
  return <PageBack label={label} onClick={onPress} />
}
