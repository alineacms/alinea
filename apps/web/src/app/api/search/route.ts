import {cms} from '@/cms'
import {Entry} from 'alinea/core/Entry'
import {snippet} from 'alinea/core/pages/Snippet'

export async function GET(request: Request) {
  const searchTerm = new URL(request.url).searchParams.get('query')
  if (!searchTerm) return Response.json([])
  const matches = await cms.find({
    location: cms.workspaces.main.pages,
    disableSync: true,
    search: searchTerm.split(' '),
    take: 25,
    select: {
      title: Entry.title,
      url: Entry.url,
      snippet: snippet('[[mark]]', '[[/mark]]', '…', 25),
      parents: {
        parents: {},
        select: {
          id: Entry.entryId,
          title: Entry.title
        }
      }
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
