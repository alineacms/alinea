import styler from '@alinea/styler'
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from 'alinea/components'
import css from './DemoReset.module.scss'

const styles = styler(css)

export interface DemoResetProps {
  onReset(): void
}

/** A floating reminder that demo changes are temporary, with a way out */
export function DemoReset({onReset}: DemoResetProps) {
  return (
    <div className={styles.DemoReset()} data-slot="demo-reset">
      <span className={styles.DemoReset.text()}>
        Changes are kept in this browser session
      </span>
      <Dialog>
        <DialogTrigger variant="ghost" size="sm">
          Reset demo
        </DialogTrigger>
        <DialogContent role="alertdialog">
          <DialogHeader>
            <DialogTitle>Reset the demo?</DialogTitle>
            <DialogDescription>
              Everything you changed in this session is discarded and the demo
              content is restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose variant="ghost">Cancel</DialogClose>
            <Button color="destructive" onClick={onReset}>
              Reset demo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
