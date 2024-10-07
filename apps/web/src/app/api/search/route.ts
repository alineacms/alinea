import {cms} from '@/cms'
import alinea, {Query} from 'alinea'

export async function GET(request: Request) {
  const searchTerm = new URL(request.url).searchParams.get('query')
  if (!searchTerm) return Response.json([])
  const matches = await cms
    .in(cms.workspaces.main.pages)
    .disableSync()
    .find(
      Query.select({
        title: Query.title,
        url: Query.url,
        snippet: alinea.snippet('[[mark]]', '[[/mark]]', '…', 25),
        parents: Query.parents().select({
          id: Query.id,
          title: Query.title
        })
      })
        .search(...searchTerm.split(' '))
        .take(25)
    )

  return Response.json(
    matches.map(match => {
      return {
        ...match,
        snippet: match.snippet
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\[\[mark\]\]/g, '<mark>')
          .replace(/\[\[\/mark\]\]/g, '</mark>')
      }
    })
  )
}
