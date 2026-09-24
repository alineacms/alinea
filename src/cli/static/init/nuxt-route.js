import {Query} from 'alinea'
import {cms} from '~~/cms'

// Answers the page at a url, query it with
// useFetch('/api/page', {query: {url: route.path}})
export default defineEventHandler(async event => {
  const {url} = getQuery(event)
  const page = await cms.first({
    url: String(url),
    select: {title: Query.title}
  })
  if (!page) throw createError({statusCode: 404, statusMessage: 'Not found'})
  return page
})
