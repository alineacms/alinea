import {cms} from '@/cms'
import {MediaFile} from 'alinea/core/media/MediaTypes'

interface RouteProps {
  params: Promise<{file: string}>
}

export const dynamic = 'force-static'
export const revalidate = 60 * 60

export async function GET(_: Request, {params}: RouteProps) {
  const {file} = await params
  const extensionIndex = file.lastIndexOf('.')
  const path = extensionIndex > 0 ? file.slice(0, extensionIndex) : file
  const extension = extensionIndex > 0 ? file.slice(extensionIndex) : ''
  const query = {
    root: cms.workspaces.primary.media,
    type: MediaFile,
    filter: {extension},
    select: MediaFile.location
  }
  const location = await cms.first({...query, path})
  if (location)
    return new Response(null, {
      status: 302,
      headers: {Location: location}
    })
  const alias = await cms.first({
    root: cms.workspaces.primary.media,
    type: MediaFile,
    alias: `/media/${file}`,
    select: MediaFile.location
  })
  if (alias)
    return new Response(null, {
      status: 301,
      headers: {Location: alias}
    })
  return new Response('Not found', {status: 404})
}
