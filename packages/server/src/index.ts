import {IncomingMessage, ServerResponse} from 'http'
import {Config} from 'packages/core/src/Config'

export function serve(config: Config) {
  return (req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.end(JSON.stringify({status: 'ok'}))
  }
}
