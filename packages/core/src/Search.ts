import {Collection} from '@alinea/store'

export type Search = {id: string; title: string}

export const Search = new Collection<Search>('Search', {
  flat: true,
  columns: ['id', 'title']
})
