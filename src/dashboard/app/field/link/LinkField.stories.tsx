import {Button, DialogTrigger} from '#/components.js'
import type {LocalConnection} from '#/core/Connection.js'
import {Field} from '#/core/Field.js'
import {Reference} from '#/core/Reference.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {Type, type, type Type as TypeInstance} from '#/core/Type.js'
import {localUser} from '#/core/User.js'
import {image, link, type LinkRow} from '#/field/link.js'
import type {LinkField} from '#/field/link/LinkField.js'
import {text} from '#/field/text.js'
import '#/theme.css'
import type {CSSProperties} from 'react'
import {useMemo} from 'react'
import {cms, db} from '../../../fixture/cms.ts?alinea'
import {Dashboard, DashboardEditor, ReactiveNode} from '../../../store.js'
import {DashboardScopeInternal, EditorScope} from '../../../store/hooks.js'
import {ExternalLinkPicker} from '../../ExternalLinkPicker.js'
import {ImagePicker} from '../../ImagePicker.js'
import {LinkPicker} from '../../LinkPicker.js'
import {views} from '../views.js'
import {
  MultipleLinksFieldView,
  SingleLinkFieldView
} from './LinkField.view.js'

interface StoryLinkFields {
  label: string
  note: string
}

type StoryLinkRow = LinkRow & StoryLinkFields

const homeId = '31Q6y4BTRh5q8Aep0M8H1v7qax1'
const helloWorldId = '31Q7Mce4fyl2rAx9eJ8sP0nVvZd'
const landscapeId = '2V4cZVEDtL1vrIdrk3gqsR3Jc5t'

const entryLink = {
  [Reference.id]: 'related-home',
  [Reference.type]: 'entry',
  [ListRow.index]: 'a0',
  _entry: homeId,
  label: 'Primary navigation item',
  note: 'Shown in the header'
} satisfies StoryLinkRow

const externalLink = {
  [Reference.id]: 'docs-url',
  [Reference.type]: 'url',
  [ListRow.index]: 'a1',
  _url: 'https://alineacms.com/docs',
  _title: 'Alinea documentation',
  _target: '_blank',
  label: 'Documentation',
  note: 'External resource'
} satisfies StoryLinkRow

const childEntryLink = {
  [Reference.id]: 'hello-world',
  [Reference.type]: 'entry',
  [ListRow.index]: 'a2',
  _entry: helloWorldId,
  label: 'Related article',
  note: 'Shows parent breadcrumbs'
} satisfies StoryLinkRow

const imageLink = {
  [Reference.id]: 'hero-landscape',
  [Reference.type]: 'image' as const,
  _entry: landscapeId,
  alt: 'Landscape hero image'
}

const pageType = type('Page', {
  fields: {
    relatedLink: link('Related link', {
      initialValue: entryLink
    }),
    heroImage: image('Hero image', {
      fields: {
        alt: text('Alt text')
      },
      initialValue: imageLink
    }),
    resources: link.multiple('Resources', {
      fields: {
        label: text('Label'),
        note: text('Note', {multiline: true})
      },
      initialValue: [entryLink, externalLink, childEntryLink]
    })
  }
})

const storyStyle: CSSProperties = {
  maxWidth: 760,
  padding: 24,
  display: 'grid',
  gap: 24
}

const pickerStoryStyle: CSSProperties = {
  padding: 24
}

const fixtureConnection: LocalConnection = {
  mutate(mutations) {
    return db.mutate(mutations)
  },
  previewToken() {
    return Promise.resolve('dev-preview-token')
  },
  resolve(query) {
    return db.resolve(query)
  },
  user() {
    return Promise.resolve(localUser)
  },
  write(request) {
    return db.write(request)
  },
  getTreeIfDifferent(sha) {
    return db.getTreeIfDifferent(sha)
  },
  getBlobs(shas) {
    return db.getBlobs(shas)
  },
  revisions() {
    return Promise.resolve([])
  },
  revisionData() {
    return Promise.resolve(undefined)
  },
  getDraft() {
    return Promise.resolve(undefined)
  },
  storeDraft() {
    return Promise.resolve()
  },
  prepareUpload(file) {
    return db.prepareUpload(file)
  }
}

const dashboard = new Dashboard(
  db,
  cms.config,
  db.index,
  fixtureConnection,
  views
)

export function Example() {
  const editor = useMemo(() => {
    const node = new ReactiveNode(Type.initialValue(pageType) as object)
    return new DashboardEditor(dashboard, pageType as TypeInstance, node)
  }, [])
  const relatedLink = Field.isField(pageType.relatedLink)
    ? pageType.relatedLink
    : null
  const heroImage = Field.isField(pageType.heroImage) ? pageType.heroImage : null
  const resources = Field.isField(pageType.resources) ? pageType.resources : null
  if (!relatedLink || !heroImage || !resources) return null
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <EditorScope editor={editor}>
        <div style={storyStyle}>
          <SingleLinkFieldView field={relatedLink} />
          <SingleLinkFieldView
            field={heroImage as unknown as LinkField<LinkRow, unknown>}
          />
          <MultipleLinksFieldView field={resources} />
        </div>
      </EditorScope>
    </DashboardScopeInternal>
  )
}

interface ExternalPickerStoryProps {
  selectionMode: 'single' | 'multiple'
}

function ExternalPickerStory({selectionMode}: ExternalPickerStoryProps) {
  return (
    <div style={pickerStoryStyle}>
      <DialogTrigger defaultOpen>
        <Button>
          {selectionMode === 'multiple'
            ? 'Pick external links'
            : 'Pick external link'}
        </Button>
        <ExternalLinkPicker
          selectionMode={selectionMode}
          onConfirm={value => console.info(value)}
        />
      </DialogTrigger>
    </div>
  )
}

interface ExplorerPickerStoryProps {
  label: string
  multiple?: boolean
  picker: 'entry' | 'file' | 'image'
}

function ExplorerPickerStory({
  label,
  multiple = false,
  picker
}: ExplorerPickerStoryProps) {
  const selectionMode = multiple ? 'multiple' : 'single'
  const selectionBehavior = multiple ? 'toggle' : 'replace'
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <div style={pickerStoryStyle}>
        <DialogTrigger defaultOpen>
          <Button>{label}</Button>
          {picker === 'entry' ? (
            <LinkPicker
              selectionMode={selectionMode}
              selectionBehavior={selectionBehavior}
              onConfirm={selection => console.info(selection)}
            />
          ) : (
            <ImagePicker
              label={label}
              selectionMode={selectionMode}
              selectionBehavior={selectionBehavior}
              onConfirm={selection => console.info(selection)}
            />
          )}
        </DialogTrigger>
      </div>
    </DashboardScopeInternal>
  )
}

export function ExternalLinkPickerSingle() {
  return <ExternalPickerStory selectionMode="single" />
}

export function ExternalLinkPickerMultiple() {
  return <ExternalPickerStory selectionMode="multiple" />
}

export function ImagePickerSingle() {
  return <ExplorerPickerStory label="Pick an image" picker="image" />
}

export function ImagePickerMultiple() {
  return <ExplorerPickerStory label="Pick images" multiple picker="image" />
}

export function FilePickerSingle() {
  return <ExplorerPickerStory label="Pick a file" picker="file" />
}

export function FilePickerMultiple() {
  return <ExplorerPickerStory label="Pick files" multiple picker="file" />
}

export function EntryPickerSingle() {
  return <ExplorerPickerStory label="Pick an entry" picker="entry" />
}

export function EntryPickerMultiple() {
  return <ExplorerPickerStory label="Pick entries" multiple picker="entry" />
}

export default {
  title: 'Fields / LinkField'
}
