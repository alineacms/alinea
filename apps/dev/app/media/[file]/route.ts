import {cms} from '@/cms'
import {MediaFile} from 'alinea/core/media/MediaTypes'

interface RouteProps {
  params: Promise<{file: string}>
}

export const dynamic = 'force-static'
export const revalidate = 60 * 60

async function mediaLocation(file: string) {
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
  return location ?? cms.first({...query, alias: `/${path}`})
}

export async function GET(_: Request, {params}: RouteProps) {
  const {file} = await params
  const location = await mediaLocation(file)
  if (!location) return new Response('Not found', {status: 404})
  return new Response(null, {
    status: 307,
    headers: {Location: location}
  })
}
