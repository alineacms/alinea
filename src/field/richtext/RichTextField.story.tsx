import {type} from '#/core/Type.js'
import {FieldsEditor} from '#/dashboard/app/EntryFields.js'
import {EntryEditor} from '#/dashboard/atoms/editor.js'
import {ReactiveNode} from '#/dashboard/atoms/ReactiveNode.js'
import {EditorScope} from '#/dashboard/hooks.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import {cms, db} from '#/dashboard/fixture/cms.ts?alinea'
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
const imageBody = richText('Body', {enableImages: true})
const imageEntry = type('Image entry', {fields: {body: imageBody}})
const readOnlyImageBody = richText('Body', {
  enableImages: true,
  readOnly: true
})
const readOnlyImageEntry = type('Read-only image entry', {
  fields: {body: readOnlyImageBody}
})
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

export function RichTextImageStory() {
  return (
    <RichTextFixture
      initialBody={[paragraph('Insert an image after this paragraph.')]}
      entryType={imageEntry}
      withDashboard
    />
  )
}

export function RichTextImageDisabledStory() {
  return <RichTextFixture initialBody={imageValue} entryType={plainEntry} />
}

export function RichTextReadOnlyImageStory() {
  return (
    <RichTextFixture initialBody={imageValue} entryType={readOnlyImageEntry} />
  )
}

export function RichTextLargeStory() {
  return <RichTextFixture initialBody={largeBody} entryType={plainEntry} />
}

export function RichTextImportedListStory() {
  return (
    <RichTextFixture initialBody={importedListBody} entryType={plainEntry} />
  )
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
    | typeof imageEntry
    | typeof readOnlyImageEntry
    | typeof customEntry
    | typeof readOnlyEntry
  withDashboard?: boolean
}

function RichTextFixture({
  initialBody,
  entryType,
  withDashboard = false
}: RichTextFixtureProps) {
  const state = useMemo(() => {
    const node = new ReactiveNode<object>({
      body: structuredClone(initialBody)
    })
    return {
      node,
      editor: new EntryEditor(entryType, node)
    }
  }, [entryType, initialBody])
  const content = (
    <RichTextFixtureContent editor={state.editor} node={state.node} />
  )
  return withDashboard ? (
    <StoryProvider
      client={db}
      config={cms.config}
      events={db.index}
      graph={db}
      views={views}
    >
      {content}
    </StoryProvider>
  ) : (
    <StoryProvider views={views}>{content}</StoryProvider>
  )
}

interface RichTextFixtureContentProps {
  editor: EntryEditor
  node: ReactiveNode<object>
}

function RichTextFixtureContent({editor, node}: RichTextFixtureContentProps) {
  const field = editor.field('body')
  if (!field) throw new Error('Body field not found')
  const value = useAtomValue(field.value)
  const dirty = useAtomValue(node.isDirty)
  const reset = useSetAtom(node.reset)
  const replace = useSetAtom(field.value)
  return (
    <EditorScope editor={editor}>
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

const imageValue = [
  paragraph('Text before an existing image.'),
  {
    _type: 'image',
    _id: 'existing-image',
    _entry: '2V4cZVEDtL1vrIdrk3gqsR3Jc5t',
    _link: 'image',
    src: 'http://localhost:3100/landscape.2V4cZVLipKGYEYJTIK1GMBHJMY0.jpg',
    alt: 'A mountain path through a valley'
  }
]

const largeBody = Array.from({length: 500}, (_, index) =>
  paragraph(`Large document paragraph ${index + 1}`)
)

const importedListBody = [
  paragraph(
    'There are multiple hyperspectral imaging technologies. Each applies different techniques to filter the light and capture the image data. The key differentiators you need to keep an eye on are:'
  ),
  {
    _type: 'orderedList',
    content: [
      importedListItem(
        'acquisition speed',
        ' – the time required to capture the hyperspectral data cube'
      ),
      importedListItem(
        'snapshot capability',
        ' – the ability to acquire a hyperspectral image, without scanning'
      ),
      importedListItem(
        'spatial resolution',
        ' – the size of the pixel array, similar to regular photography'
      ),
      importedListItem(
        'spectral resolution',
        ' – the number of frequency bands (or layers) each hyperspectral image contains.'
      )
    ]
  },
  paragraph(
    'Selecting the required properties is a tradeoff, driven by the requirements of the application.'
  )
]

function importedListItem(label: string, description: string) {
  return {
    _type: 'listItem',
    content: [
      {_type: 'text', text: label, marks: [{_type: 'bold'}]},
      {_type: 'text', text: description}
    ]
  }
}
