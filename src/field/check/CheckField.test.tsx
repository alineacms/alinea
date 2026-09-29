import {cleanup, render, screen, waitFor} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {type} from '#/core/Type.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {check} from './CheckField.js'
import {CheckFieldView} from './CheckField.view.js'

afterEach(cleanup)

function renderCheck(autoFocus?: boolean) {
  const field = check('Published', {autoFocus})
  const entry = type('Entry', {fields: {published: field}})
  const editor = new EntryEditor(
    entry,
    new ReactiveNode<object>({published: false})
  )
  return render(
    <StoryProvider>
      <EditorScope editor={editor}>
        <CheckFieldView field={field} />
      </EditorScope>
    </StoryProvider>
  )
}

test('check fields focus automatically with autoFocus', async () => {
  renderCheck(true)
  const checkbox = await screen.findByRole('checkbox')
  await waitFor(() => expect(document.activeElement).toBe(checkbox))
})

test('check fields do not take focus by default', async () => {
  renderCheck()
  const checkbox = await screen.findByRole('checkbox')
  expect(document.activeElement).not.toBe(checkbox)
})
