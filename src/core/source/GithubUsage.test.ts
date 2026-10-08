import {suite} from '@alinea/suite'
import {GithubUsage} from './GithubUsage.js'

const test = suite(import.meta)

function response(resource: string, remaining: number, status = 200): Response {
  return new Response(null, {
    status,
    headers: {
      'x-ratelimit-resource': resource,
      'x-ratelimit-remaining': String(remaining),
      'x-ratelimit-limit': '5000',
      'x-ratelimit-reset': String(Date.UTC(2026, 9, 8, 11, 0) / 1000)
    }
  })
}

function captureLogs<T>(run: () => T): {
  info: Array<string>
  warn: Array<string>
} {
  const logs = {info: Array<string>(), warn: Array<string>()}
  const {info, warn} = console
  console.info = (message: string) => logs.info.push(message)
  console.warn = (message: string) => logs.warn.push(message)
  try {
    run()
  } finally {
    console.info = info
    console.warn = warn
  }
  return logs
}

test('logs what an operation spent and what is left', () => {
  const usage = new GithubUsage()
  const logs = captureLogs(() => {
    const before = usage.count()
    usage.record(response('core', 4200, 304))
    usage.record(response('core', 4199))
    usage.record(response('graphql', 4980))
    usage.log('sync', before)
  })
  test.equal(logs.warn, [])
  test.equal(logs.info, [
    'Alinea GitHub sync: 1 REST, 1 GraphQL requests; REST 4199/5000 left, graphql 4980/5000 left, resets 11:00 UTC'
  ])
})

test('logs nothing for an operation that only got free answers', () => {
  const usage = new GithubUsage()
  const logs = captureLogs(() => {
    const before = usage.count()
    usage.record(response('core', 4200, 304))
    usage.log('sync', before)
  })
  test.equal(logs.info, [])
  test.equal(logs.warn, [])
})

test('warns when a budget is running out', () => {
  const usage = new GithubUsage()
  const logs = captureLogs(() => {
    const before = usage.count()
    usage.record(response('core', 120))
    usage.log('blobs', before)
  })
  test.equal(logs.info, [])
  test.is(logs.warn.length, 1)
  test.ok(logs.warn[0].includes('REST 120/5000 left'))
})
