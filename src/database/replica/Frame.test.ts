import {expect, test} from 'bun:test'
import {crypto, Blob, CompressionStream, Response} from '@alinea/iso'
import {
  createFrameKey,
  decryptFrame,
  encryptFrame,
  type FrameIdentity
} from './Frame.js'

const identity: FrameIdentity = {
  project: 'project',
  namespace: 'main',
  epoch: 'epoch',
  schemaId: 'schema',
  configId: 'config',
  releaseId: 'release',
  versionId: '["a",null,"published"]',
  payloadId: 'payload',
  kind: 'data'
}
const contents = new TextEncoder().encode(
  JSON.stringify({data: {title: 'Private entry'}})
)

test('independent AES-GCM frames round-trip compressed and raw binary payloads', async () => {
  const key = createFrameKey()
  for (const compression of ['gzip', 'none'] as const) {
    const frame = await encryptFrame(identity, contents, key, compression)
    expect(
      await decryptFrame(identity, frame.descriptor, frame.ciphertext, key)
    ).toEqual(contents)
    expect(frame).not.toHaveProperty('key')
    expect(new TextDecoder().decode(frame.ciphertext)).not.toContain(
      'Private entry'
    )
    const next = await encryptFrame(identity, contents, key, compression)
    expect(next.descriptor.nonce).not.toEqual(frame.descriptor.nonce)
  }
})

test('every identity dimension is checked and cryptographically bound to its bytes', async () => {
  const key = createFrameKey()
  const {descriptor, ciphertext} = await encryptFrame(identity, contents, key)
  for (const field of Object.keys(identity) as Array<keyof FrameIdentity>) {
    const changed = {
      ...identity,
      [field]: field === 'kind' ? 'search' : `${identity[field]}:other`
    }
    await expect(
      decryptFrame(changed, descriptor, ciphertext, key)
    ).rejects.toThrow('identity mismatch')
    // A forged descriptor matching the caller's expected identity still fails GCM.
    await expect(
      decryptFrame(changed, {...descriptor, ...changed}, ciphertext, key)
    ).rejects.toThrow()
  }
  const altered = ciphertext.slice()
  altered[0] ^= 1
  await expect(
    decryptFrame(identity, descriptor, altered, key)
  ).rejects.toThrow()
  await expect(
    decryptFrame(identity, descriptor, ciphertext, createFrameKey())
  ).rejects.toThrow()
  await expect(
    decryptFrame(
      identity,
      {...descriptor, plaintextLength: contents.length + 1},
      ciphertext,
      key
    )
  ).rejects.toThrow()
  await expect(
    decryptFrame(
      identity,
      {...descriptor, compression: 'none'},
      ciphertext,
      key
    )
  ).rejects.toThrow()
})

test('frame inputs are captured before asynchronous encryption and decoding', async () => {
  const key = createFrameKey()
  const input = contents.slice()
  const binding = {...identity}
  const pending = encryptFrame(binding, input, key)
  binding.project = 'changed'
  input.fill(0)
  const frame = await pending
  const decoding = decryptFrame(
    identity,
    frame.descriptor,
    frame.ciphertext,
    key
  )
  frame.descriptor.project = 'changed'
  frame.descriptor.nonce.fill(0)
  frame.ciphertext.fill(0)
  expect(await decoding).toEqual(contents)
})

test('frame limits, truncation, invalid nonce and cancellation reject before returning plaintext', async () => {
  const key = createFrameKey()
  const {descriptor, ciphertext} = await encryptFrame(identity, contents, key)
  await expect(
    decryptFrame(identity, descriptor, ciphertext, key, {
      plaintext: 1,
      ciphertext: 1000
    })
  ).rejects.toThrow('limits')
  await expect(
    decryptFrame(identity, descriptor, ciphertext, key, {
      plaintext: 1000,
      ciphertext: 1
    })
  ).rejects.toThrow('limits')
  await expect(
    decryptFrame(identity, descriptor, ciphertext.slice(1), key)
  ).rejects.toThrow('Incomplete')
  await expect(
    decryptFrame(
      identity,
      {...descriptor, nonce: new Uint8Array(8)},
      ciphertext,
      key
    )
  ).rejects.toThrow('nonce')
  await expect(
    encryptFrame(identity, contents, new Uint8Array(16))
  ).rejects.toThrow('32 bytes')
  const controller = new AbortController()
  const pending = decryptFrame(
    identity,
    descriptor,
    ciphertext,
    key,
    undefined,
    controller.signal
  )
  controller.abort(new Error('Revoked'))
  await expect(pending).rejects.toThrow('Revoked')
})

test('an authenticated producer length error cannot expand past its declared plaintext size', async () => {
  const key = createFrameKey()
  const compressed = new Uint8Array(
    await new Response(
      new Blob([new Uint8Array(100000)])
        .stream()
        .pipeThrough(new CompressionStream('gzip'))
    ).arrayBuffer()
  )
  const descriptor = {
    ...identity,
    nonce: crypto.getRandomValues(new Uint8Array(12)),
    compression: 'gzip' as const,
    plaintextLength: 8,
    ciphertextLength: compressed.length + 16
  }
  const aad = new TextEncoder().encode(
    JSON.stringify([
      'alinea.sqlite.frame.v1',
      identity.project,
      identity.namespace,
      identity.epoch,
      identity.schemaId,
      identity.configId,
      identity.releaseId,
      identity.versionId,
      identity.payloadId,
      identity.kind,
      'gzip',
      8,
      compressed.length + 16
    ])
  )
  const imported = await crypto.subtle.importKey(
    'raw',
    key.slice(),
    'AES-GCM',
    false,
    ['encrypt']
  )
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv: descriptor.nonce, additionalData: aad},
      imported,
      compressed
    )
  )
  await expect(
    decryptFrame(identity, descriptor, ciphertext, key)
  ).rejects.toThrow('exceeds declared length')
})
