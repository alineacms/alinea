import {cms} from '@/cms'

export async function GET(request: Request) {
  return Response.json((await cms.user()) ?? null)
}
