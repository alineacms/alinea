import {ServerResponse} from 'http'

// Source: https://github.com/dougmoscrop/serverless-http/blob/f72fdeaa0d25844257e01ff1078585a92752f53a/lib/finish.js
export function finishResponse(res: ServerResponse) {
  return new Promise<void>((resolve, reject) => {
    if (res.writableEnded) return resolve()
    let finished = false
    function done(err?: Error) {
      if (finished) return
      finished = true
      res.removeListener('error', done)
      res.removeListener('end', done)
      res.removeListener('finish', done)
      if (err) reject(err)
      else resolve()
    }
    res.once('error', done)
    res.once('end', done)
    res.once('finish', done)
  })
}
