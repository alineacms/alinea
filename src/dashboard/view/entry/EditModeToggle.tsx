import {Icon, fromModule} from 'alinea/ui'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {MdiSourceBranch} from 'alinea/ui/icons/MdiSourceBranch'
import css from './EditModeToggle.module.scss'

const styles = fromModule(css)

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
