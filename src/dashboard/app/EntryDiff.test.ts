import {cleanup, fireEvent, render, screen, waitFor} from '#test/react.js'
import {describe, expect, test} from 'bun:test'
import {afterEach} from 'bun:test'
import {createElement} from 'react'
import {
  EntryDiff,
  alignRichTextBlocks,
  fieldChangeKind,
  resolvedFieldValue,
  type EntryDiffField
} from './EntryDiff.js'

afterEach(cleanup)

function field(values: Partial<EntryDiffField>): EntryDiffField {
  return {
    id: 'title',
    label: 'Title',
    baseValue: 'Base',
    localValue: 'Base',
    ...values
  }
}

describe('EntryDiff', () => {
  test('classifies three-way changes', () => {
    expect(fieldChangeKind(field({serverValue: 'Base'}))).toBe('same')
    expect(
      fieldChangeKind(field({localValue: 'Local', serverValue: 'Base'}))
    ).toBe('local')
    expect(fieldChangeKind(field({serverValue: 'Server'}))).toBe('server')
    expect(
      fieldChangeKind(field({localValue: 'Local', serverValue: 'Server'}))
    ).toBe('conflict')
  })

  test('auto-merges one-sided changes and applies explicit choices', () => {
    const remoteOnly = field({serverValue: 'Server'})
    expect(resolvedFieldValue(remoteOnly, {})).toBe('Server')
    expect(
      resolvedFieldValue(remoteOnly, {
        title: {choice: 'custom', value: 'Merged'}
      })
    ).toBe('Merged')
  })

  test('shows an explicit keep control for every conflict choice', async () => {
    render(
      createElement(EntryDiff, {
        fields: [
          field({
            baseValue: 'Base',
            localValue: 'Local',
            serverValue: 'Server'
          })
        ],
        mode: 'resolve'
      })
    )

    expect(screen.getAllByText('Keep this')).toHaveLength(2)
    const choices = screen.getAllByRole<HTMLInputElement>('radio')
    expect(choices).toHaveLength(2)
    expect(choices[0].checked).toBeFalse()
    expect(choices[1].checked).toBeFalse()

    fireEvent.click(choices[1])

    await waitFor(() => {
      expect(choices[0].checked).toBeFalse()
      expect(choices[1].checked).toBeTrue()
    })
  })

  test('renders structured field values without JSON blobs', () => {
    const {container} = render(
      createElement(EntryDiff, {
        fields: [
          field({
            label: 'Metadata',
            baseValue: {
              title: 'Before',
              createdAt: 1_700_000_000,
              createdBy: {name: 'Alice', email: 'alice@example.com'}
            },
            localValue: {
              title: 'After',
              createdAt: 1_700_000_000,
              createdBy: {name: 'Bob', email: 'bob@example.com'}
            },
            valueKind: 'object'
          })
        ]
      })
    )

    expect(screen.getAllByText('Created at')).toHaveLength(2)
    expect(screen.getAllByText('Created by')).toHaveLength(2)
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
    expect(container.textContent).not.toContain('"createdAt"')
    expect(container.textContent).not.toContain('{')
  })

  test('aligns inserted rich text blocks without replacing later content', () => {
    const paragraph = (text: string) => ({
      _type: 'paragraph',
      content: [{_type: 'text', text}]
    })
    const before = [paragraph('First paragraph'), paragraph('Second paragraph')]
    const after = [
      {
        _type: 'heading',
        level: 2,
        content: [{_type: 'text', text: 'Inserted heading'}]
      },
      ...before
    ]

    expect(alignRichTextBlocks(before, after).map(item => item.kind)).toEqual([
      'insert',
      'same',
      'same'
    ])
  })

  test('aligns edited rich text blocks by stable id', () => {
    const before = [{_type: 'Callout', _id: 'callout-1', title: 'Before'}]
    const after = [{_type: 'Callout', _id: 'callout-1', title: 'After'}]

    expect(alignRichTextBlocks(before, after).map(item => item.kind)).toEqual([
      'changed'
    ])
  })
})
