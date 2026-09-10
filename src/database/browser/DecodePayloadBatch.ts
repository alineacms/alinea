import {isRecord} from '#/core/util/Objects.js'
import {
  payloadBatchLimit,
  payloadRequestLimit,
  type PayloadBatchRequest
} from '../replica/PayloadBatch.js'
import type {SerializedPayload} from '../runtime/EntryRuntime.js'

/** Decode authenticated raw SQLite JSON payloads without parsing their bodies. */
export async function decodePayloadStream(
  stream: ReadableStream<Uint8Array>,
  expected: PayloadBatchRequest,
  onPayload?: (payload: SerializedPayload) => void | Promise<void>
): Promise<Array<SerializedPayload>> {
  const requests = new Map(
    expected.requests.map(request => [request.versionId, request.payloadId])
  )
  if (
    requests.size !== expected.requests.length ||
    requests.size > payloadRequestLimit
  )
    throw new Error('Invalid payload request batch')

  const reader = stream.getReader()
  const decoder = new TextDecoder('utf-8', {fatal: true})
  const found = new Map<string, SerializedPayload>()
  let buffer = ''
  let bytes = 0
  let line = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      bytes += next.value.byteLength
      if (bytes > payloadBatchLimit)
        throw new Error('Payload batch exceeds byte limit')
      buffer += decoder.decode(next.value, {stream: true})
      let newline: number
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const value = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        if (!value) throw new Error('Invalid empty payload line')
        const pending = decodeLine(
          value,
          line++,
          expected,
          requests,
          found,
          onPayload
        )
        if (pending) await pending
      }
    }
    buffer += decoder.decode()
    if (buffer) {
      const pending = decodeLine(
        buffer,
        line++,
        expected,
        requests,
        found,
        onPayload
      )
      if (pending) await pending
    }
    if (line === 0 || found.size !== expected.requests.length)
      throw new Error('Incomplete payload response')
    return expected.requests.map(request => found.get(request.versionId)!)
  } catch (error) {
    await reader.cancel(error).catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}

function decodeLine(
  value: string,
  line: number,
  expected: PayloadBatchRequest,
  requests: Map<string, string>,
  found: Map<string, SerializedPayload>,
  onPayload?: (payload: SerializedPayload) => void | Promise<void>
): void | Promise<void> {
  if (line === 0) {
    let header: unknown
    try {
      header = JSON.parse(value)
    } catch {
      throw new Error('Invalid payload response header')
    }
    return validateHeader(header, expected)
  }
  const first = value.indexOf('\t')
  const second = value.indexOf('\t', first + 1)
  const third = value.indexOf('\t', second + 1)
  if (first < 1 || second < first + 2 || third < second + 2)
    throw new Error('Invalid payload row')
  let versionId: unknown
  let payloadId: unknown
  try {
    versionId = JSON.parse(value.slice(0, first))
    payloadId = JSON.parse(value.slice(first + 1, second))
  } catch {
    throw new Error('Invalid payload row identity')
  }
  const dataJson = value.slice(second + 1, third)
  const sourceJson = value.slice(third + 1)
  if (
    typeof versionId !== 'string' ||
    typeof payloadId !== 'string' ||
    requests.get(versionId) !== payloadId ||
    found.has(versionId) ||
    !dataJson ||
    sourceJson.includes('\t')
  )
    throw new Error('Unexpected payload row')
  const payload: SerializedPayload = {
    versionId,
    payloadId,
    dataJson,
    sourceJson: sourceJson === 'null' ? undefined : sourceJson
  }
  found.set(versionId, payload)
  return onPayload?.(payload)
}

function validateHeader(value: unknown, expected: PayloadBatchRequest): void {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.revision !== expected.revision ||
    !isRecord(value.identity)
  )
    throw new Error('Invalid payload response')
  for (const key of [
    'project',
    'namespace',
    'epoch',
    'schemaId',
    'configId',
    'releaseId',
    'principal',
    'viewId'
  ] as const)
    if (
      !expected.identity[key] ||
      value.identity[key] !== expected.identity[key]
    )
      throw new Error('Payload response identity mismatch')
}
