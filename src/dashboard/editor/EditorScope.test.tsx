import {cleanup, render, screen} from '#test/react.js'
import {afterEach, expect, test} from 'bun:test'
import type {Editor} from '../atoms/EditorAtoms.js'
import {EditorScope, useEditor} from './EditorScope.js'

afterEach(cleanup)

const labels = new WeakMap<Editor, string>()

function createEditor(label: string): Editor {
  const editor = {} as Editor
  labels.set(editor, label)
  return editor
}

function Label() {
  return <span>{labels.get(useEditor())}</span>
}

test('sibling editor scopes remain isolated', () => {
  render(
    <>
      <EditorScope editor={createEditor('first')}>
        <Label />
      </EditorScope>
      <EditorScope editor={createEditor('second')}>
        <Label />
      </EditorScope>
    </>
  )

  expect(screen.getByText('first')).toBeDefined()
  expect(screen.getByText('second')).toBeDefined()
})

test('changing the editor updates the nearest scope', () => {
  const {rerender} = render(
    <EditorScope editor={createEditor('first')}>
      <Label />
    </EditorScope>
  )

  rerender(
    <EditorScope editor={createEditor('second')}>
      <Label />
    </EditorScope>
  )

  expect(screen.queryByText('first')).toBeNull()
  expect(screen.getByText('second')).toBeDefined()
})
