import {EditField, useField, type TypeViewProps} from '#/cms.js'
import {TextField} from '#/components.js'
import {LocalDB} from '#/database/LocalDB.js'
import {Policy} from '#/core/Role.js'
import {localUser} from '#/core/User.js'
import {views} from '#/field/views.js'
import {Config, Field} from '#/index.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {createStore, Provider} from 'jotai'
import {type CSSProperties, type ReactNode, Suspense, use} from 'react'
import {
  alineaDevAtom,
  clientAtom,
  configAtom,
  eventsAtom,
  graphAtom,
  localAtom,
  viewsAtom
} from '../../atoms/core.js'
import {preloadUserPolicyAtom} from '../../atoms/user.js'
import {entryPage} from './EntryPage.js'

const frameStyle: CSSProperties = {height: 560}

const viewStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 280px',
  height: '100%'
}

const editStyle: CSSProperties = {padding: 24}

const asideStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 24,
  borderInlineStart: '1px solid var(--alinea-border)',
  background: 'var(--alinea-bg)'
}

/** Fills the area below the entry header and edits the entry's fields */
function ProductView(_: TypeViewProps) {
  const [summary = '', setSummary] = useField(Product.summary)
  return (
    <div style={viewStyle}>
      <div style={editStyle}>
        <TextField
          label="Summary"
          multiline
          rows={8}
          value={summary}
          onValueChange={setSummary}
        />
      </div>
      <aside style={asideStyle}>
        <EditField field={Product.price} />
        <p>{summary.length} characters</p>
      </aside>
    </div>
  )
}

const Product = Config.document('Product', {
  view: ProductView,
  fields: {
    summary: Field.text('Summary', {multiline: true}),
    price: Field.number('Price')
  }
})

const config = Config.create({
  enableDrafts: true,
  schema: {Product},
  workspaces: {
    main: Config.workspace('Main', {
      source: 'content',
      roots: {products: Config.root('Products', {contains: ['Product']})}
    })
  }
})

async function load(): Promise<ReactNode> {
  const db = new LocalDB(config)
  await db.sync()
  const product = await db.create({
    type: Product,
    set: {title: 'Chair', summary: 'A wooden chair', price: 120}
  })
  const store = createStore()
  store.set(configAtom, config)
  store.set(graphAtom, db)
  store.set(eventsAtom, db.events)
  store.set(clientAtom, createTestConnection(db))
  store.set(viewsAtom, views)
  store.set(localAtom, true)
  store.set(alineaDevAtom, false)
  store.set(preloadUserPolicyAtom, localUser, Policy.ALLOW_ALL)
  const page = await entryPage(
    {
      type: 'entry',
      workspace: 'main',
      root: 'products',
      entry: product._id,
      locale: null,
      view: undefined
    },
    store.get
  )
  return <Provider store={store}>{page}</Provider>
}

let loaded: Promise<ReactNode> | undefined

function Loaded() {
  return use((loaded ??= load()))
}

/** A type `view` below the entry header, editing the fields of the entry */
export function TypeView() {
  return (
    <div style={frameStyle}>
      <Suspense fallback={null}>
        <Loaded />
      </Suspense>
    </div>
  )
}

export default {
  title: 'Dashboard / Entry page'
}
