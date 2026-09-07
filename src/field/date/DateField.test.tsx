import {cleanup, render} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {I18nProvider} from 'react-aria-components'
import {type} from '#/core/Type.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {date} from './DateField.js'
import {DateFieldView} from './DateField.view.js'

afterEach(cleanup)

test('date fields use day/month/year even with a US surrounding locale', () => {
  const field = date('Date')
  const entry = type('Entry', {fields: {date: field}})
  const editor = new EntryEditor(
    entry,
    new ReactiveNode<object>({date: '2026-11-30'})
  )
  const {container} = render(
    <StoryProvider>
      <I18nProvider locale="en-US">
        <EditorScope editor={editor}>
          <DateFieldView field={field} />
        </EditorScope>
      </I18nProvider>
    </StoryProvider>
  )
  expect(
    Array.from(container.querySelectorAll('[role="spinbutton"]')).map(
      element => element.textContent
    )
  ).toEqual(['30', '11', '2026'])
})
