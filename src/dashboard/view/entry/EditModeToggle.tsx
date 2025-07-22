import styler from '@alinea/styler'
import {Icon} from 'alinea/ui'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import {useTranslation} from '../../hook/useTranslation.js'
import css from './EditModeToggle.module.scss'

const styles = styler(css)

export const copy = {
  edit: 'Edit',
  review: 'Review changes'
}

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export interface EditModeToggleProps {
  mode: EditMode
  onChange: (mode: EditMode) => void
}

export function EditModeToggle({mode, onChange}: EditModeToggleProps) {
  const t = useTranslation(copy)
  return (
    <div className={styles.root()}>
      <button
        className={styles.root.switch({active: mode === EditMode.Editing})}
        onClick={() => onChange(EditMode.Editing)}
      >
        <Icon icon={IcRoundEdit} title={t.edit} />
      </button>
      <button
        className={styles.root.switch({active: mode === EditMode.Diff})}
        onClick={() => onChange(EditMode.Diff)}
      >
        <Icon icon={MdiSourceBranch} title={t.review} />
      </button>
    </div>
  )
}
