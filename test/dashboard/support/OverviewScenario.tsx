import {LocalDB} from '#/database/LocalDB.js'
import {App} from '#/dashboard/App.js'
import {views} from '#/field/views.js'
import {createTestConnection} from '#test/CreateConnection.js'
import {
  Blog,
  BlogPost,
  Brand,
  Category,
  Event,
  Person,
  Product,
  config
} from '#test/overview.js'
import {use, useState} from 'react'
import {overviewPhotoPreview, overviewScenarioIds as ids} from './OverviewScenarioData.js'

function link(id: string, entry: string, index?: string) {
  return {
    _id: id,
    _type: 'entry' as const,
    _entry: entry,
    ...(index ? {_index: index} : {})
  }
}

async function createOverviewScenario() {
  const db = new LocalDB(config)
  await db.sync()
  const main = {workspace: 'main'}
  await db.create({...main, id: ids.acme, type: Brand, root: 'brands', set: {title: 'Acme'}})
  await db.create({...main, id: ids.zeta, type: Brand, root: 'brands', set: {title: 'Zeta'}})
  await db.create({...main, id: ids.chairs, type: Category, root: 'categories', set: {title: 'Chairs'}})
  await db.create({...main, id: ids.tables, type: Category, root: 'categories', set: {title: 'Tables'}})
  const product = (id: string, title: string, set: Record<string, unknown>) =>
    db.create({...main, id, type: Product, root: 'products', set: {title, ...set}})
  await product(ids.chair, 'Chair', {
    articleNumber: 'A-100',
    price: 20,
    brand: link('b1', ids.zeta),
    categories: [link('c1', ids.chairs, 'a0')]
  })
  await product(ids.table, 'Table', {
    articleNumber: 'A-200',
    price: 5,
    brand: link('b2', ids.acme),
    categories: [link('c2', ids.tables, 'a0'), link('c3', ids.chairs, 'a1')]
  })
  await product(ids.lamp, 'Lamp', {articleNumber: 'A-300', price: 12})
  await db.create({...main, id: ids.ann, type: Person, root: 'people', set: {title: 'Ann'}})
  await db.create({...main, id: ids.bob, type: Person, root: 'people', set: {title: 'Bob'}})
  await db.mutate([
    {
      op: 'create',
      id: ids.photo,
      type: 'MediaFile',
      locale: null,
      workspace: 'main',
      root: 'media',
      data: {
        title: 'Photo',
        path: 'photo',
        location: 'photo.gif',
        extension: '.gif',
        size: 1024,
        width: 1200,
        height: 800,
        hash: 'photo',
        preview: overviewPhotoPreview,
        averageColor: '#777777'
      }
    }
  ])
  await db.create({...main, id: ids.blog, type: Blog, root: 'blog', set: {title: 'Blog'}})
  await db.create({
    ...main,
    id: ids.post,
    type: BlogPost,
    root: 'blog',
    parentId: ids.blog,
    set: {
      title: 'Post',
      publishDate: '2026-01-02',
      author: link('a1', ids.bob),
      cover: {_id: 'i1', _type: 'image', _entry: ids.photo}
    }
  })
  await db.create({
    ...main,
    id: ids.event,
    type: Event,
    root: 'blog',
    parentId: ids.blog,
    set: {
      title: 'Meetup',
      publishDate: '2026-03-04',
      organiser: link('o1', ids.ann)
    }
  })
  return {db, client: createTestConnection(db)}
}

export function OverviewScenario() {
  const [scenario] = useState(createOverviewScenario)
  const {client, db} = use(scenario)
  return (
    <App
      graph={db}
      events={db.events}
      config={config}
      client={client}
      views={views}
      local
    />
  )
}
