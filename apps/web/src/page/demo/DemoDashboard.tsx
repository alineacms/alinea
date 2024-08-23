'use client'

import * as schema from '@/schema/demo'
import {Config, Edit} from 'alinea'
import {createCMS} from 'alinea/adapter/test/TestCMS'
import {memoryBackend} from 'alinea/backend/data/MemoryBackend'
import {createHandler} from 'alinea/backend/Handler'
import {Entry} from 'alinea/core/Entry'
import {EntryPhase} from 'alinea/core/EntryRow'
import {localUser} from 'alinea/core/User'
import 'alinea/css'
import {App} from 'alinea/dashboard/App'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {use, useDeferredValue, useMemo} from 'react'
import {DemoHomePage} from './DemoHomePage'
import {DemoRecipePage} from './DemoRecipePage'

const config = {
  schema,
  workspaces: {
    demo: Config.workspace('Milk & Cookies', {
      color: '#3F61E8',
      mediaDir: 'public',
      source: 'content',
      roots: {
        pages: Config.root('Pages'),
        media: Config.media()
      }
    })
  },
  preview({entry}) {
    switch (entry.type) {
      case 'DemoHome':
        return <PreviewHome entry={entry} />
      case 'DemoRecipe':
        return <PreviewRecipe entry={entry} />
      default:
        return null
    }
  }
}

function PreviewHome({entry}) {
  const graph = useGraph()
  const update = useDeferredValue(entry)
  const props = use(
    useMemo(() => {
      return graph.preferDraft
        .previewEntry({...update, phase: EntryPhase.Draft})
        .get(DemoHomePage.fragment)
    }, [update.rowHash])
  )
  return <DemoHomePage {...props} />
}

function PreviewRecipe({entry}) {
  const graph = useGraph()
  const update = useDeferredValue(entry)
  const props = use(
    useMemo(() => {
      return graph.preferDraft
        .previewEntry({...update, phase: EntryPhase.Draft})
        .get(DemoRecipePage.fragment.wherePath(update.path))
    }, [update.rowHash])
  )
  return <DemoRecipePage {...props} />
}

async function setup(entries: Array<Entry>) {
  const cms = createCMS(config)
  for (const entry of entries) {
    await cms.commit(Edit.createEntry(entry))
  }
  const db = await cms.db
  const backend = memoryBackend(db)
  const handler = createHandler(cms, backend)
  const client = handler.connect({
    apiKey: 'dev',
    user: localUser
  })
  return {cms, client}
}

export interface DemoProps {
  entries: Array<Entry>
}

export default function Demo({entries}: DemoProps) {
  const {cms, client} = use(useMemo(() => setup(entries), [entries]))
  return <App dev config={cms.config} client={client} />
}
