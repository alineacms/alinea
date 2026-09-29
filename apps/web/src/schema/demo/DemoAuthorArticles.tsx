'use client'

import {Config, type OverviewOptions} from 'alinea'
import {EntryTable, useEntry} from 'alinea/cms'
import {Field} from 'alinea/components'
import {DemoArticle} from './DemoArticle'

const articles: OverviewOptions = {
  columns: {
    category: Config.column({header: 'Category', select: DemoArticle.category}),
    publishDate: Config.column({
      header: 'Published',
      width: 140,
      select: DemoArticle.publishDate
    })
  },
  sort: {desc: DemoArticle.publishDate}
}

/** The articles written by the author being edited */
export function DemoAuthorArticles() {
  const entry = useEntry()
  if (!entry) return null
  return (
    <Field label="Articles" description="Journal articles by this author">
      <EntryTable
        aria-label="Articles"
        type={DemoArticle}
        overview={articles}
        filter={{author: {has: {_entry: entry.id}}}}
        emptyMessage="No articles yet"
      />
    </Field>
  )
}
