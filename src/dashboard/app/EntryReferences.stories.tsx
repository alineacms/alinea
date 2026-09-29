import {Config, Field} from '#/index.js'
import type {EntryReference} from '#/core/db/EntryReference.js'
import type {
  EntryReferenceSource,
  EntryReferenceWithSource
} from '#/dashboard/atoms/entry.js'
import {StoryProvider} from '#/dashboard/StoryProvider.js'
import type {CSSProperties} from 'react'
import {IcRoundFeed, IcRoundDescription, IcRoundPublic} from '../icons.js'
import {EntryReferenceList} from './EntryReferences.js'

const Page = Config.document('Page', {
  icon: IcRoundDescription,
  fields: {}
})
const Article = Config.document('Article', {
  icon: IcRoundFeed,
  fields: {}
})
const Home = Config.document('Home', {
  icon: IcRoundPublic,
  fields: {}
})
const Plain = Config.document('Plain', {fields: {title: Field.text('Title')}})

const config = Config.create({
  schema: {Page, Article, Home, Plain},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {pages: Config.root('Pages')}
    })
  }
})

const storyStyle: CSSProperties = {width: 322, padding: 14}

function source(
  id: string,
  type: string,
  title: string,
  path: string,
  locale: string | null = null
): EntryReferenceSource {
  return {
    id,
    title,
    type,
    workspace: 'main',
    root: 'pages',
    locale,
    status: 'published',
    path,
    url: `/${path}`
  }
}

function reference(
  from: EntryReferenceSource,
  fieldLabels: Array<string>,
  status: EntryReference['sourceStatus'] = 'published'
): EntryReferenceWithSource {
  return {
    source: from,
    reference: {
      targetId: 'media',
      sourceId: from.id,
      sourceFilePath: `pages/${from.path}.json`,
      sourceType: from.type,
      sourceLocale: from.locale,
      sourceStatus: status,
      sourceActive: true,
      sourceMain: true,
      fieldPath: fieldLabels.join('.').toLowerCase(),
      fieldLabel: fieldLabels.at(-1),
      fieldLabels,
      linkType: 'image'
    }
  }
}

const home = source('home', 'Home', 'Home', 'index')
const detail = source('detail', 'Page', 'Page detail 1', 'parent/detail-1')
const article = source('article', 'Article', 'Launch article', 'news/launch')
const plain = source('plain', 'Plain', 'Untyped icon', 'plain')

const references = [
  reference(home, ['Hero', 'Call to action', 'File']),
  reference(home, ['Metadata', 'Open Graph', 'Image']),
  reference(detail, ['Blocks', 'Documents', 'Links']),
  reference(detail, ['Blocks', 'Documents', 'Links'], 'draft'),
  reference(article, ['Body']),
  reference(plain, ['Image'])
]

function noop() {}

export function MediaReferences() {
  return (
    <StoryProvider config={config}>
      <div style={storyStyle}>
        <EntryReferenceList
          references={references}
          locale={null}
          onSelect={noop}
        />
      </div>
    </StoryProvider>
  )
}

export function OtherLanguages() {
  const localized = [
    reference(source('en', 'Page', 'About', 'about', 'en'), ['Image']),
    reference(source('fr', 'Page', 'À propos', 'a-propos', 'fr'), ['Image']),
    reference(source('nl', 'Page', 'Over ons', 'over-ons', 'nl'), ['Image'])
  ]
  return (
    <StoryProvider config={config}>
      <div style={storyStyle}>
        <EntryReferenceList
          references={localized}
          locale="en"
          onSelect={noop}
        />
      </div>
    </StoryProvider>
  )
}

export function NoReferences() {
  return (
    <StoryProvider config={config}>
      <div style={storyStyle}>
        <EntryReferenceList references={[]} locale={null} onSelect={noop} />
      </div>
    </StoryProvider>
  )
}

export default {
  title: 'Dashboard / EntryReferences'
}
