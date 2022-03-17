import {createId, Entry, EntryStatus} from '@alinea/core'
import {Data} from '@alinea/backend'

export const source: Data.Source = {
  async *entries(): AsyncGenerator<Entry> {
    yield {
      id: 'stories',
      type: 'StoryDir',
      workspace: 'stories',
      root: 'data',
      title: 'Stories',
      url: '/',
      index: 'a0',
      parent: null,
      parents: [],
      $isContainer: true,
      $status: EntryStatus.Published
    }
    yield {
      id: 'lots',
      type: 'StoryDir',
      workspace: 'stories',
      root: 'data',
      title: 'Lots of entries',
      url: '/lots',
      index: 'a0',
      parent: null,
      parents: ['stories'],
      $isContainer: true,
      $status: EntryStatus.Published
    }
    const stories = Array.from({length: 1}).map(() => createId())
    for (const entry of stories) {
      yield {
        id: entry,
        type: 'Story',
        workspace: 'stories',
        root: 'data',
        title: entry,
        url: '/lots/' + entry,
        index: 'a0',
        parent: 'lots',
        parents: ['stories', 'lots'],
        $status: EntryStatus.Published
      }
    }
  }
}
