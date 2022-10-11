import {Request, Response} from '@alinea/iso'
// @ts-ignore
import {LoaderArgs, Response as RemixResponse} from '@remix-run/node'

// Workaround for remix-run/remix#4354

export function remixHandler(
  handler: (
    request: Request
  ) => Promise<Response | undefined> | Response | undefined
) {
  return async ({request}: LoaderArgs) => {
    const result = await handler(request)
    if (result) return new RemixResponse(result.body, result)
    return new RemixResponse('Not found', {status: 404})
  }
}
