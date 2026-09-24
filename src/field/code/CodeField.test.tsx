import {cleanup, render} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import {type} from '#/core/Type.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {code} from './CodeField.js'
import {CodeFieldView} from './CodeField.view.js'

afterEach(cleanup)

function renderCode(language?: string) {
  const field = code('Code', {language})
  const entry = type('Entry', {fields: {code: field}})
  const editor = new EntryEditor(
    entry,
    new ReactiveNode<object>({code: 'const a = "b"'})
  )
  return render(
    <StoryProvider>
      <EditorScope editor={editor}>
        <CodeFieldView field={field} />
      </EditorScope>
    </StoryProvider>
  )
}

test('code fields expose their language', () => {
  const {container} = renderCode('ts')
  const editor = container.querySelector('[data-language]')
  expect(editor?.getAttribute('data-language')).toBe('ts')
  // Code is highlighted into tokens
  expect(container.querySelectorAll('pre span').length).toBeGreaterThan(0)
})

test('plain text code fields are not highlighted', () => {
  const {container} = renderCode('text')
  expect(container.querySelectorAll('pre span').length).toBe(0)
  expect(container.querySelector('pre')?.textContent).toContain('const a')
})
