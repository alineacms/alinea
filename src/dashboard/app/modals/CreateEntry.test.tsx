import {suite} from '@alinea/suite'
import '#/dashboard/dom.js'
import {Button, DialogTrigger} from '#/components.js'
import type {LocalConnection} from '#/core/Connection.js'
import {Entry} from '#/core/Entry.js'
import {localUser} from '#/core/User.js'
import {slugify} from '#/core/util/Slugs.js'
import {cleanup, fireEvent, render} from '@testing-library/react'
import {act} from 'react'
import {DashboardScopeInternal} from '../../store/hooks.js'
import {Dashboard} from '../../store.js'
import {cms, db} from '../../fixture/cms.ts?alinea'
import {views} from '../field/views.js'
import {CreateEntry} from './CreateEntry.js'
import {DashboardModal} from '../ui/DashboardModal.js'

const test = suite(import.meta, {
  afterEach() {
    cleanup()
    window.location.hash = ''
  }
})

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

function createDashboard() {
  return new Dashboard(db, cms.config, db.index, fixtureConnection, views)
}

interface ExampleProps {
  dashboard: Dashboard
}

interface PageEntryData {
  _parentId: string | null
  title?: string
  path?: string
  summary?: string | null
}

function Example({dashboard}: ExampleProps) {
  return (
    <DashboardScopeInternal dashboard={dashboard}>
      <DialogTrigger defaultOpen>
        <Button>Create entry</Button>
        <DashboardModal>
          <CreateEntry />
        </DashboardModal>
      </DialogTrigger>
    </DashboardScopeInternal>
  )
}

test('creates an entry and copies published content from another entry', async () => {
  const pageType = cms.config.schema.Page
  const entries = await db.find({
    workspace: 'simple',
    root: 'pages',
    filter: {_type: 'Page'},
    select: {id: Entry.id, title: Entry.title},
    status: 'preferDraft'
  })
  const parent = entries[0]
  const source = entries[1]

  test.ok(parent)
  test.ok(source)

  window.location.hash = `#/entry/simple/pages/${parent.id}`

  const dashboard = createDashboard()
  const view = render(<Example dashboard={dashboard} />)
  const title = `Create entry modal ${Date.now()}`

  await act(async () => {
    fireEvent.change(view.getByRole('textbox', {name: 'Title'}), {
      target: {value: title}
    })
    await Promise.resolve()
  })

  await act(async () => {
    fireEvent.click(view.getByRole('button', {name: 'Type'}))
    await Promise.resolve()
  })

  await act(async () => {
    fireEvent.click(await view.findByRole('option', {name: 'Page'}))
    await Promise.resolve()
  })

  await act(async () => {
    fireEvent.click(view.getByRole('button', {name: 'Page link'}))
    await Promise.resolve()
  })

  await act(async () => {
    fireEvent.click(await view.findByRole('option', {name: String(source.title)}))
    await Promise.resolve()
  })

  const form = view.getByRole('textbox', {name: 'Title'}).closest('form')

  test.ok(Boolean(form))

  await act(async () => {
    fireEvent.submit(form!)
    await new Promise(resolve => globalThis.setTimeout(resolve, 0))
  })

  const newId = window.location.hash.split('/').pop()
  test.ok(Boolean(newId))

  const created = await db.first({
    id: newId,
    type: pageType,
    status: 'preferDraft'
  }) as PageEntryData | null
  const sourceEntry = await db.first({
    id: source.id,
    type: pageType,
    status: 'preferPublished'
  }) as PageEntryData | null

  test.ok(Boolean(created))
  test.ok(Boolean(sourceEntry))
  test.is(created?._parentId, parent.id)
  test.is(created?.title, title)
  test.is(created?.path, slugify(title))
  test.is(created?.summary, sourceEntry?.summary)
})
