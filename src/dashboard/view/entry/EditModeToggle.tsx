import styler from '@alinea/styler'
import {Icon} from '#/ui.js'
import {IcRoundEdit} from '#/ui/icons/IcRoundEdit.js'
import {MdiSourceBranch} from '#/ui/icons/MdiSourceBranch.js'
import css from './EditModeToggle.module.scss'

const styles = styler(css)

export enum EditMode {
  Editing = 'editing',
  Diff = 'diff'
}

export interface EditModeToggleProps {
  mode: EditMode
  onChange: (mode: EditMode) => void
}

export function EditModeToggle({mode, onChange}: EditModeToggleProps) {
  return (
    <div className={styles.root()}>
      <button
        className={styles.root.switch({active: mode === EditMode.Editing})}
        onClick={() => onChange(EditMode.Editing)}
      >
        <Icon icon={IcRoundEdit} title="Edit" />
      </button>
      <button
        className={styles.root.switch({active: mode === EditMode.Diff})}
        onClick={() => onChange(EditMode.Diff)}
      >
        <Icon icon={MdiSourceBranch} title="Review changes" />
      </button>
    </div>
  )
}
