import type {Config} from './Config.js'
import {trace, type Tracer} from './Trace.js'
import {expect, test} from 'bun:test'

const config = {schema: {}, workspaces: {}} as Config

test('runs without tracing', async () => {
  const span = trace(config, 'test')
  expect(await span(async () => 'result')).toBe('result')
})

test('passes the operation result through a tracer', async () => {
  const spans: Array<string> = []
  const tracer: Tracer = async (name, run) => {
    spans.push(name)
    return run()
  }
  const traced = {...config, tracer}
  const span = trace(traced, 'test')
  expect(await span(async () => 'result')).toBe('result')
  expect(spans).toEqual(['test'])
})

test('preserves an operation error', async () => {
  const failure = new Error('operation failed')
  const tracer: Tracer = async (_name, run) => run()
  const traced = {...config, tracer}
  const span = trace(traced, 'test')
  await expect(span(async () => Promise.reject(failure))).rejects.toBe(failure)
})

test('runs an operation that throws synchronously exactly once', async () => {
  const failure = new Error('operation failed')
  let calls = 0
  const tracer: Tracer = async (_name, run) => run()
  const span = trace({...config, tracer}, 'test')

  await expect(
    span(() => {
      calls++
      throw failure
    })
  ).rejects.toBe(failure)
  expect(calls).toBe(1)
})

test('allows nested spans to remain inside the configured callback', async () => {
  const events: Array<string> = []
  const tracer: Tracer = async (name, run) => {
    events.push(`start:${name}`)
    try {
      return await run()
    } finally {
      events.push(`end:${name}`)
    }
  }
  const traced = {...config, tracer}
  const outerSpan = trace(traced, 'outer')
  await outerSpan(() => {
    const innerSpan = trace(traced, 'inner')
    return innerSpan(async () => undefined)
  })
  expect(events).toEqual([
    'start:outer',
    'start:inner',
    'end:inner',
    'end:outer'
  ])
})

test('does not run an operation twice when a faulty tracer calls run twice', async () => {
  let calls = 0
  const tracer: Tracer = async (_name, run) => {
    await run()
    return run()
  }
  const span = trace({...config, tracer}, 'test')
  await span(async () => {
    calls++
  })
  expect(calls).toBe(1)
})

test('ignores a telemetry failure before the operation runs', async () => {
  const traced = {
    ...config,
    tracer: async () => {
      throw new Error('exporter unavailable')
    }
  }
  const span = trace(traced, 'test')
  expect(await span(async () => 'result')).toBe('result')
})
