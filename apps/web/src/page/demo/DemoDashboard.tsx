'use client'

import * as schema from '@/schema/demo'
import {Config, Edit} from 'alinea'
import {createMemoryHandler} from 'alinea/backend/data/MemoryHandler'
import {Entry} from 'alinea/core/Entry'
import {localUser} from 'alinea/core/User'
import {createTestCMS} from 'alinea/core/driver/TestDriver'
import {Logger} from 'alinea/core/util/Logger'
import 'alinea/css'
import {App} from 'alinea/dashboard/App'
import {useGraph} from 'alinea/dashboard/hook/UseGraph'
import {Preview} from 'alinea/dashboard/view/Preview'
import {use, useMemo} from 'react'
import {DemoHomePage} from './DemoHomePage'
import {DemoRecipePage} from './DemoRecipePage'

const previews = {
  DemoHome: DemoHomePage,
  DemoRecipe: DemoRecipePage
}

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
    return (
      <Preview>
        ok
        {/*<Suspense fallback={<div style={{width: '100%'}}>Loading</div>}>
          <EntryPreview entry={entry} />
    </Suspense>*/}
      </Preview>
    )
  }
}

function EntryPreview({entry}: {entry: Entry}) {
  const graph = useGraph()
  const view = previews[entry.type]
  if (!view) return null
  const props = use(
    useMemo(() => {
      return graph.preferDraft.get(DemoHomePage.fragment)
    }, [entry.entryId])
  )
  return <DemoHomePage {...props} />
}

async function setup(entries: Array<Entry>) {
  const cms = createTestCMS(config)
  for (const entry of entries) {
    await cms.commit(Edit.createEntry(entry))
  }
  const db = await cms.db
  const handler = createMemoryHandler(config, db)
  const client = handler.connect({
    logger: new Logger('local'),
    user: localUser
  })
  return {cms, client}
}

export interface DemoProps {
  entries: Array<Entry>
}

export default function Demo({entries}: DemoProps) {
  const {cms, client} = use(useMemo(() => setup(entries), [entries]))
  console.log(entries)
  return <App dev config={cms.config} client={client} />
}
