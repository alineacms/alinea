import {Config, Field} from 'alinea'
import {
  IcOutlineAutoStories,
  IcOutlineChair,
  IcOutlineCollectionsBookmark
} from '@/icons'
import {demoEntryUrl} from './DemoUrl'

function containerFields() {
  return {
    title: Field.text('Title', {width: 0.5, required: true}),
    path: Field.path('Path', {width: 0.5}),
    intro: Field.text('Intro', {multiline: true}),
    metadata: Field.metadata('SEO')
  }
}

export const DemoProducts = Config.type('Products', {
  icon: IcOutlineChair,
  entryUrl: demoEntryUrl,
  contains: ['DemoProduct'],
  defaultView: 'overview',
  fields: containerFields()
})

export const DemoCollections = Config.type('Collections', {
  icon: IcOutlineCollectionsBookmark,
  entryUrl: demoEntryUrl,
  contains: ['DemoCollection'],
  fields: containerFields()
})

export const DemoJournal = Config.type('Journal', {
  icon: IcOutlineAutoStories,
  entryUrl: demoEntryUrl,
  contains: ['DemoArticle'],
  fields: containerFields()
})
