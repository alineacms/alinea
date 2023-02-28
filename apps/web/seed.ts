import {config} from '@alinea/content/config.js'
import {createStore} from '@alinea/content/store.js'
import {JsonLoader} from 'alinea/backend'
import {FileData} from 'alinea/backend/data/FileData'
import {Storage} from 'alinea/backend/Storage'
import {createId, Entry, slugify} from 'alinea/core'
import fs from 'fs/promises'

const data = new FileData({
  config,
  fs,
  loader: JsonLoader,
  rootDir: process.cwd()
})

function toEntry(
  workspace: string,
  data: Partial<Entry & Record<string, any>>
): Entry {
  const path = data.path || slugify(data.title as string)
  return {
    id: data.id || createId(),
    root: 'data',
    type: 'Page',
    index: 'a0',
    path,
    url: `/${path}`,
    workspace,
    parent: undefined,
    parents: [],
    i18n: undefined,
    title: 'Example entry',
    ...data
  }
}

function createEntry() {
  const id = createId()
  return toEntry('web', {
    id,
    title: `Example entry ${id}`,
    content: [
      {
        type: 'text',
        text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam at dapibus dolor. Pellentesque a suscipit mauris, at feugiat urna. Ut vel vulputate nisi. Aliquam cursus tellus et laoreet commodo. Nam id semper lorem. Nullam at pulvinar est. Nullam porta ex rhoncus bibendum rutrum. Aliquam blandit volutpat nisi, non mattis neque. Sed vitae nulla vitae diam consequat euismod eget et ante. Nulla ullamcorper mattis mollis. Etiam tristique posuere pretium.
        Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Cras a turpis sed turpis tristique interdum et at nisi. Aliquam bibendum rutrum malesuada. Suspendisse vitae odio velit. Mauris volutpat tellus id ex aliquam convallis. Sed et scelerisque tellus. Morbi sed malesuada dolor. Mauris malesuada imperdiet lacinia. Phasellus neque orci, cursus eget augue in, bibendum dapibus felis. Vestibulum vestibulum mattis tortor a molestie. Ut rutrum nisl arcu, sit amet rutrum mauris dictum vel. Curabitur gravida augue eu magna tempus cursus. Aenean porttitor eget ipsum at volutpat. Donec molestie malesuada maximus. Suspendisse condimentum velit sed neque tincidunt fermentum.`
      }
    ]
  })
}

async function main() {
  const store = await createStore()
  const changes = await Storage.publishChanges(
    config,
    store,
    JsonLoader,
    Array.from({length: 5000}).map(createEntry),
    false
  )
  return data.publish({
    changes
  })
}

main()
  .then(console.log)
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
