import {btoa} from 'alinea/core/util/Encoding'
import {concatUint8Arrays, hexToBytes} from 'alinea/core/source/Utils'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface GitRefAdvertisement {
  capabilities: Set<string>
  refs: Map<string, string>
}

export interface ReceivePackStatus {
  unpackStatus?: string
  refStatus: Map<string, string>
  messages: Array<string>
}

export function gitBasicAuth(token: string) {
  return `Basic ${btoa(`x-access-token:${token}`)}`
}

export function pktLine(data: string | Uint8Array): Uint8Array {
  const bytes = typeof data === 'string' ? encoder.encode(data) : data
  const length = (bytes.length + 4).toString(16).padStart(4, '0')
  return concatUint8Arrays([encoder.encode(length), bytes])
}

export function flushPkt(): Uint8Array {
  return encoder.encode('0000')
}

export function parseAdvertisement(data: Uint8Array): GitRefAdvertisement {
  const packets = parsePktLines(data)
  const refs = new Map<string, string>()
  const capabilities = new Set<string>()
  let firstRef = true
  for (const packet of packets) {
    if (packet === null) continue
    const text = decoder.decode(packet)
    if (text.startsWith('# service=')) continue
    const line = text.replace(/\n$/, '')
    if (!line) continue
    if (firstRef) {
      firstRef = false
      const nulIndex = line.indexOf('\0')
      const refPart = nulIndex === -1 ? line : line.slice(0, nulIndex)
      const capabilityPart = nulIndex === -1 ? '' : line.slice(nulIndex + 1)
      const [sha, ref] = refPart.split(' ')
      if (sha && ref) refs.set(ref, sha)
      for (const capability of capabilityPart.split(' ')) {
        if (capability) capabilities.add(capability)
      }
      continue
    }
    const [sha, ref] = line.split(' ')
    if (sha && ref) refs.set(ref, sha)
  }
  return {capabilities, refs}
}

export function buildUploadPackRequest(
  wants: Array<string>,
  capabilities: Set<string>
): Uint8Array {
  const requestedCaps = [
    capabilities.has('side-band-64k') ? 'side-band-64k' : undefined,
    capabilities.has('ofs-delta') ? 'ofs-delta' : undefined,
    'no-progress'
  ].filter(Boolean)
  const packets: Array<Uint8Array> = []
  wants.forEach((sha, index) => {
    const line =
      index === 0 && requestedCaps.length
        ? `want ${sha} ${requestedCaps.join(' ')}\n`
        : `want ${sha}\n`
    packets.push(pktLine(line))
  })
  packets.push(flushPkt(), pktLine('done\n'))
  return concatUint8Arrays(packets)
}

export function buildReceivePackRequest(input: {
  oldSha: string
  newSha: string
  ref: string
  capabilities: Set<string>
  pack: Uint8Array
}): Uint8Array {
  const requestedCaps = [
    input.capabilities.has('report-status') ? 'report-status' : undefined,
    input.capabilities.has('side-band-64k') ? 'side-band-64k' : undefined,
    input.capabilities.has('ofs-delta') ? 'ofs-delta' : undefined
  ].filter(Boolean)
  const command = `${input.oldSha} ${input.newSha} ${input.ref}\0${requestedCaps.join(' ')}\n`
  return concatUint8Arrays([pktLine(command), flushPkt(), input.pack])
}

export function extractSidebandData(data: Uint8Array): {
  channel1: Uint8Array
  messages: Array<string>
} {
  const packets = parsePktLines(data)
  const channel1 = Array<Uint8Array>()
  const messages = Array<string>()
  for (const packet of packets) {
    if (!packet || packet.length === 0) continue
    const channel = packet[0]
    const payload = packet.subarray(1)
    if (channel === 1) channel1.push(payload)
    else messages.push(decoder.decode(payload).replace(/\n$/, ''))
  }
  return {
    channel1: concatUint8Arrays(channel1),
    messages
  }
}

export function parseReceivePackStatus(data: Uint8Array): ReceivePackStatus {
  const {channel1, messages} = extractSidebandData(data)
  const text = decoder.decode(channel1)
  const refStatus = new Map<string, string>()
  let unpackStatus: string | undefined
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('unpack ')) {
      unpackStatus = line.slice('unpack '.length)
      continue
    }
    if (line.startsWith('ok ')) {
      refStatus.set(line.slice(3), 'ok')
      continue
    }
    if (line.startsWith('ng ')) {
      const [ref, ...reason] = line.slice(3).split(' ')
      refStatus.set(ref, reason.join(' '))
    }
  }
  return {unpackStatus, refStatus, messages}
}

export function findPackStart(data: Uint8Array): number {
  const marker = encoder.encode('PACK')
  outer: for (let i = 0; i <= data.length - marker.length; i++) {
    for (let j = 0; j < marker.length; j++) {
      if (data[i + j] !== marker[j]) continue outer
    }
    return i
  }
  return -1
}

export function encodeRefDeltaBase(baseSha: string): Uint8Array {
  return hexToBytes(baseSha)
}

function parsePktLines(data: Uint8Array): Array<Uint8Array | null> {
  const packets = Array<Uint8Array | null>()
  let pos = 0
  while (pos + 4 <= data.length) {
    const length = Number.parseInt(decoder.decode(data.subarray(pos, pos + 4)), 16)
    pos += 4
    if (length === 0) {
      packets.push(null)
      continue
    }
    const payloadLength = length - 4
    packets.push(data.subarray(pos, pos + payloadLength))
    pos += payloadLength
  }
  return packets
}
