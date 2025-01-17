import {cms} from '@/cms'
import {Query} from 'alinea'

export async function GET(request: Request) {
  const searchTerm = new URL(request.url).searchParams.get('query')
  if (!searchTerm) return Response.json([])
  const matches = await cms.find({
    location: cms.workspaces.main.pages,
    disableSync: true,
    search: searchTerm.split(' '),
    take: 25,
    select: {
      title: Query.title,
      url: Query.url,
      snippet: Query.snippet('[[mark]]', '[[/mark]]', '…', 25),
      parents: Query.parents({
        select: {
          id: Query.id,
          title: Query.title
        }
      })
    }
  })
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
