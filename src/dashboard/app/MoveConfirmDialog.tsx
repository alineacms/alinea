import {Button, Text} from '#/components.js'
import {
  confirmMovesAtom,
  moveConfirmationAtom
} from '#/dashboard/atoms/moveConfirmation.js'
import styler from '@alinea/styler'
import {useAtomValueRaw, useSetAtom} from 'jotai'
import {useState} from 'react'
import {IcRoundDriveFileMove} from '../icons.js'
import css from './MoveConfirmDialog.module.css'
import {
  DashboardModal,
  DashboardModalContent,
  DashboardModalDialog,
  DashboardModalFooter
} from './ui/DashboardModal.js'

const styles = styler(css)

/**
 * Asks before a drag moves pages under another parent, changing their urls,
 * or tells why the dragged entries can not move there
 */
export function MoveConfirmDialog() {
  const confirmation = useAtomValueRaw(moveConfirmationAtom)
  const setConfirmMoves = useSetAtom(confirmMovesAtom)
  // The question stays the same while the dialog closes
  const [shown, setShown] = useState(confirmation)
  if (confirmation && confirmation !== shown) setShown(confirmation)
  const {pages = [], refusal} = confirmation ?? shown ?? {}
  const single = pages.length === 1
  const title = single && pages[0].title ? `"${pages[0].title}"` : 'this page'
  const answer = (confirmed: boolean) => confirmation?.resolve(confirmed)
  return (
    <DashboardModal
      open={Boolean(confirmation)}
      onOpenChange={isOpen => {
        if (!isOpen) answer(false)
      }}
    >
      {refusal ? (
        <DashboardModalDialog label="Can't move here">
          <DashboardModalContent>
            <Text as="p">{refusal}</Text>
          </DashboardModalContent>
          <DashboardModalFooter>
            <div className={styles.MoveConfirmDialog.actions()}>
              <Button onClick={() => answer(false)}>OK</Button>
            </div>
          </DashboardModalFooter>
        </DashboardModalDialog>
      ) : (
        <DashboardModalDialog label={single ? 'Move page' : 'Move pages'}>
          <DashboardModalContent>
            <Text as="p">
              {single
                ? `Are you sure you want to move ${title}? This permanently changes the URL of this page and of all pages below it.`
                : `Are you sure you want to move these ${pages.length} pages? This permanently changes their URLs and those of all pages below them.`}
            </Text>
          </DashboardModalContent>
          <DashboardModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmMoves(false)
                answer(true)
              }}
            >
              Move and don't ask again
            </Button>
            <div className={styles.MoveConfirmDialog.actions()}>
              <Button variant="ghost" onClick={() => answer(false)}>
                Cancel
              </Button>
              <Button icon={IcRoundDriveFileMove} onClick={() => answer(true)}>
                Move
              </Button>
            </div>
          </DashboardModalFooter>
        </DashboardModalDialog>
      )}
    </DashboardModal>
  )
}
