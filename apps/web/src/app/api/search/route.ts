import {cms} from '@/cms'
import alinea from 'alinea'
import {Entry} from 'alinea/core'

export async function GET(request: Request) {
  const searchTerm = new URL(request.url).searchParams.get('query')
  if (!searchTerm) return Response.json([])
  const matches = await cms
    .in(cms.workspaces.main.pages)
    .syncInterval(0)
    .find(
      Entry()
        .select({
          title: Entry.title,
          url: Entry.url,
          snippet: alinea.snippet(),
          parents({parents}) {
            return parents().select({
              id: Entry.entryId,
              title: Entry.title
            })
          }
        })
        .search(...searchTerm.split(' '))
        .take(25)
    )
  return Response.json(matches)
}

export const runtime = 'edge'
