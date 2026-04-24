import {Field} from '#/core/Field.js'
import {Type, type, type Type as TypeInstance} from '#/core/Type.js'
import {Reference} from '#/core/Reference.js'
import {ListRow} from '#/core/shape/ListShape.js'
import {link, type LinkRow} from '#/field/link.js'
import '#/theme.css'
import {atom, type Atom} from 'jotai'
import type {ComponentType, CSSProperties} from 'react'
import {useMemo} from 'react'
import {Dashboard, DashboardEditor, ReactiveNode} from '../../../store.js'
import {DashboardScopeInternal, EditorScope} from '../../../store/hooks.js'
import {views} from '../views.js'
import {
  MultipleLinksFieldView,
  SingleLinkFieldView
} from './LinkField.view.js'

const entryLink = {
  [Reference.id]: 'related-home',
  [Reference.type]: 'entry',
  [ListRow.index]: 'a0',
  _entry: 'home'
} satisfies LinkRow

const externalLink = {
  [Reference.id]: 'docs-url',
  [Reference.type]: 'url',
  [ListRow.index]: 'a1',
  _url: 'https://alineacms.com/docs',
  _title: 'Alinea documentation',
  _target: '_blank'
} satisfies LinkRow

const pageType = type('Page', {
  fields: {
    relatedLink: link('Related link', {
      initialValue: entryLink
    }),
    resources: link.multiple('Resources', {
      initialValue: [entryLink, externalLink]
    })
  }
})

const storyStyle: CSSProperties = {
  maxWidth: 760,
  padding: 24,
  display: 'grid',
  gap: 24
}

interface StoryEntryType {
  label: string
}

interface StoryEntry {
  label: Atom<string>
  type: Atom<StoryEntryType>
}

interface StoryDashboard {
  view(key: string): Atom<ComponentType | undefined>
  entries(id: string): Atom<StoryEntry>
}

const storyEntries: Record<string, StoryEntry> = {
  home: {
    label: atom('Home'),
    type: atom({label: 'Page'})
  }
}

const missingEntry: StoryEntry = {
  label: atom('Missing entry'),
  type: atom({label: 'Unknown'})
}

const dashboard = {
  view(key) {
    return atom(() => views[key])
  },
  entries(id) {
    return atom(storyEntries[id] ?? missingEntry)
  }
} satisfies StoryDashboard as unknown as Dashboard

export function Example() {
  const editor = useMemo(() => {
    const node = new ReactiveNode(Type.initialValue(pageType) as object)
    return new DashboardEditor(dashboard, pageType as TypeInstance, node)
  }, [])
  const relatedLink = Field.isField(pageType.relatedLink)
    ? pageType.relatedLink
    : null
  const resources = Field.isField(pageType.resources) ? pageType.resources : null
  if (!relatedLink || !resources) return null
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <EditorScope editor={editor}>
        <div style={storyStyle}>
          <SingleLinkFieldView field={relatedLink} />
          <MultipleLinksFieldView field={resources} />
        </div>
      </EditorScope>
    </DashboardScopeInternal>
  )
}

export default {
  title: 'Fields / LinkField'
}
