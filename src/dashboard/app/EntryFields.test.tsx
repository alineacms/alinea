import {cleanup, render, screen} from '#test/react.js'
import {Type, type} from '#/core/Type.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {hidden} from '#/field/hidden.js'
import {text} from '#/field/text.js'
import {view} from '#/field/view.js'
import {views} from '#/field/views.js'
import {afterEach, expect, test} from 'bun:test'
import {EntryFields, fieldWidth} from './EntryFields.js'

afterEach(cleanup)

test('field widths retain their configured percentages', () => {
  expect(fieldWidth(0.2)).toBe('calc(20% - var(--alinea-field-gap) * 0.8)')
  expect(fieldWidth(0.6)).toBe('calc(60% - var(--alinea-field-gap) * 0.4)')
  expect(fieldWidth()).toBe('100%')
})

test('field widths stay within the supported range', () => {
  expect(fieldWidth(-1)).toBe('0px')
  expect(fieldWidth(2)).toBe('100%')
})

function renderFields(page: Type) {
  const editor = new EntryEditor(
    page,
    new ReactiveNode(Type.initialValue(page) as object)
  )
  return render(
    <StoryProvider views={views}>
      <EditorScope editor={editor}>
        <EntryFields />
      </EditorScope>
    </StoryProvider>
  )
}

test('no form card for a section without visible fields', () => {
  const {container} = renderFields(
    type('Page', {
      fields: {
        title: text('Title', {hidden: true}),
        path: hidden('Path'),
        ...view(<p>Summary</p>)
      }
    })
  )
  expect(screen.getByText('Summary')).toBeTruthy()
  expect(container.querySelectorAll('[data-slot="surface"]').length).toBe(0)
})

test('a form card for a section with a visible field', () => {
  const {container} = renderFields(
    type('Page', {
      fields: {
        title: text('Title'),
        path: hidden('Path'),
        ...view(<p>Summary</p>)
      }
    })
  )
  expect(screen.getByText('Summary')).toBeTruthy()
  expect(screen.getByRole('textbox', {name: 'Title'})).toBeTruthy()
  expect(container.querySelectorAll('[data-slot="surface"]').length).toBe(1)
})
