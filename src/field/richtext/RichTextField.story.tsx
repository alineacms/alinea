import {type} from '#/core/Type.js'
import type {LocalConnection} from '#/core/Connection.js'
import type {WriteableGraph} from '#/core/db/WriteableGraph.js'
import {FieldsEditor} from '#/dashboard/app/Editor.js'
import {DashboardScopeInternal, EditorScope} from '#/dashboard/hooks.js'
import {createDashboard} from '#/dashboard/atoms/DashboardAtoms.js'
import {createEditor} from '#/dashboard/atoms/EditorAtoms.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {richText} from './RichTextField.js'
import {
  alignment,
  formatting,
  headings,
  inserts,
  links,
  lists,
  quotes,
  tables
} from './Toolbar.js'
import {check} from '#/field/check.js'
import {code} from '#/field/code.js'
import {select} from '#/field/select.js'
import {text} from '#/field/text/TextField.js'
import {useAtomValue, useSetAtom} from 'jotai'
import {useMemo} from 'react'
import {views} from '../views.js'

const note = type('Note', {
  fields: {text: text('Text', {multiline: true})}
})

const callout = type('Callout', {
  fields: {
    title: text('Title'),
    details: richText('Details', {schema: {Note: note}})
  }
})

const cta = type('Call to action', {
  fields: {
    title: text('CTA title'),
    text: text('CTA text', {multiline: true}),
    actionCode: code('Action code', {language: 'ts'}),
    variant: select('Variant', {
      options: {
        primary: 'Primary',
        secondary: 'Secondary',
        subtle: 'Subtle'
      },
      initialValue: 'primary'
    }),
    targets: select.multiple('Targets', {
      options: {header: 'Header', sidebar: 'Sidebar', footer: 'Footer'},
      initialValue: ['header', 'footer']
    }),
    details: richText('CTA details', {schema: {Note: note}}),
    featured: check('Featured')
  }
})

const body = richText('Body', {
  schema: {Callout: callout, Cta: cta},
  enableTables: true
})
const entry = type('Entry', {fields: {body}})
const plainBody = richText('Body', {enableTables: true})
const plainEntry = type('Plain entry', {fields: {body: plainBody}})
const customBody = richText('Body', {
  enableTables: true,
  extensions: extensions => ({
    ...extensions,
    Table: extensions.Table.configure({resizable: true})
  }),
  toolbar: {
    headings,
    tables: {
      ...tables,
      items(ctx) {
        const items = tables.items(ctx)
        if (ctx.editor.isActive('table')) return items
        return {
          quickInsert: {
            label: 'Quick 2x4 table',
            onSelect: ({
              exec
            }: {
              exec: () => ReturnType<typeof ctx.editor.chain>
            }) =>
              exec().insertTable({rows: 2, cols: 4, withHeaderRow: false}).run()
          },
          ...items
        }
      }
    },
    formatting,
    alignment,
    lists,
    links,
    quotes,
    inserts
  }
})
const customEntry = type('Custom entry', {fields: {body: customBody}})
const readOnlyBody = richText('Body', {
  schema: {Callout: callout, Cta: cta},
  enableTables: true,
  readOnly: true
})
const readOnlyEntry = type('Read-only entry', {fields: {body: readOnlyBody}})

export function RichTextStory() {
  return <RichTextFixture initialBody={blocksValue} entryType={entry} />
}

export function RichTextPlainStory() {
  return (
    <RichTextFixture
      initialBody={[
        paragraph('Select this text to try headings, formatting and links.'),
        paragraph('Press Enter to create another paragraph and test history.')
      ]}
      entryType={plainEntry}
    />
  )
}

export function RichTextLargeStory() {
  return <RichTextFixture initialBody={largeBody} entryType={plainEntry} />
}

export function RichTextCustomToolbarStory() {
  return (
    <RichTextFixture
      initialBody={[paragraph('Custom toolbar content.')]}
      entryType={customEntry}
    />
  )
}

export function RichTextEmptyStory() {
  return <RichTextFixture initialBody={[]} entryType={plainEntry} />
}

export function RichTextLegacyEmptyStory() {
  return (
    <RichTextFixture
      initialBody={[{_type: 'paragraph'}]}
      entryType={plainEntry}
    />
  )
}

export function RichTextReadOnlyStory() {
  return <RichTextFixture initialBody={blocksValue} entryType={readOnlyEntry} />
}

interface RichTextFixtureProps {
  initialBody: Array<object>
  entryType:
    | typeof entry
    | typeof plainEntry
    | typeof customEntry
    | typeof readOnlyEntry
}

function RichTextFixture({initialBody, entryType}: RichTextFixtureProps) {
  const state = useMemo(() => {
    const dashboard = createStoryDashboard()
    const node = new ReactiveNode<object>({
      body: structuredClone(initialBody)
    })
    return {
      dashboard,
      editor: createEditor(entryType, node)
    }
  }, [entryType, initialBody])
  const field = state.editor.field('body')
  if (!field) throw new Error('Body field not found')
  const value = useAtomValue(field.value)
  const dirty = useAtomValue(state.editor.node.isDirty)
  const reset = useSetAtom(state.editor.node.reset)
  const replace = useSetAtom(field.value)
  return (
    <DashboardScopeInternal dashboard={state.dashboard}>
      <EditorScope editor={state.editor}>
        <div id="alinea-toolbar" />
        <button type="button" onClick={() => reset()}>
          Reset body
        </button>
        <button
          type="button"
          onClick={() => replace([paragraph('Externally replaced.')])}
        >
          Replace body
        </button>
        <FieldsEditor />
        <pre data-testid="value">{JSON.stringify(value)}</pre>
        <output data-testid="dirty">{String(dirty)}</output>
      </EditorScope>
    </DashboardScopeInternal>
  )
}

function createStoryDashboard() {
  return createDashboard(
    {} as WriteableGraph,
    {schema: {}, workspaces: {}},
    new EventTarget(),
    {} as LocalConnection,
    views
  )
}

function paragraph(text: string) {
  return {
    _type: 'paragraph',
    content: [{_type: 'text', text}]
  }
}

const blocksValue = [
  paragraph('Before the block.'),
  {
    _type: 'Callout',
    _id: 'callout-1',
    title: 'Important',
    details: [paragraph('Nested details.')]
  },
  paragraph('After the block.')
]

const largeBody = Array.from({length: 500}, (_, index) =>
  paragraph(`Large document paragraph ${index + 1}`)
)
