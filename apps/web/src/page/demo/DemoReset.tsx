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
  DialogTrigger,
  Icon
} from 'alinea/components'
import {IcRoundOpenInNew} from '@/icons'
import css from './DemoReset.module.scss'

const styles = styler(css)

export interface DemoResetProps {
  /** The demo site page of the entry being edited */
  siteUrl: string
  onReset(): void
}

/**
 * A floating reminder that demo changes are temporary, with a way out and a
 * link to the demo site
 */
export function DemoReset({siteUrl, onReset}: DemoResetProps) {
  return (
    <div className={styles.DemoReset()} data-slot="demo-reset">
      <span className={styles.DemoReset.text()}>
        Changes are kept in this browser session
      </span>
      <Button asChild variant="ghost" size="sm">
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          title="Opens the published demo site, without your changes"
        >
          View site
          <Icon icon={IcRoundOpenInNew} className={styles.DemoReset.icon()} />
        </a>
      </Button>
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
