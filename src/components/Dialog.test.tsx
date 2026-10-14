import {cleanup, fireEvent, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {Dialog, DialogClose, DialogContent, DialogTitle} from './Dialog.js'

afterEach(cleanup)

test('Dialog calls onClose when it closes', () => {
  let closed = 0
  render(
    <Dialog open onClose={() => closed++}>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Rename page</DialogTitle>
        <DialogClose>Cancel</DialogClose>
      </DialogContent>
    </Dialog>
  )
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
  expect(closed).toBe(1)
})
