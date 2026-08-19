import {MemorySource} from '#/core/source/MemorySource.js'
import type {Source} from '#/core/source/Source.js'
import {
  decompressSourcePackFrame,
  parseSourcePackHeader,
  parseSourcePackIndex,
  SOURCE_PACK_HEADER_SIZE,
  type SourcePackIndex
} from '#/core/source/SourcePack.js'
import {hashBlob} from '#/core/source/GitUtils.js'
import {ReadonlyTree} from '#/core/source/Tree.js'

async function generatedSourceFile(): Promise<string> {
  const sourceId = process.env.ALINEA_SOURCE_ID
  const adminPath = process.env.ALINEA_ADMIN_PATH
  if (!sourceId || !adminPath)
    throw new Error('Alinea generated source settings are missing')
  const normalized = adminPath.startsWith('/') ? adminPath : `/${adminPath}`
  return `${normalized}/release/${sourceId}/source.pack`
}

class PackedSource implements Source {
  #complete: Uint8Array | undefined
  #memory: MemorySource | undefined
  #index: Promise<SourcePackIndex> | undefined

  constructor(private url: URL) {}

  async #range(start: number, length: number): Promise<Uint8Array> {
    if (this.#complete) return this.#complete.subarray(start, start + length)
    const response = await fetch(this.url, {
      headers: {Range: `bytes=${start}-${start + length - 1}`}
    })
    if (!response.ok)
      throw new Error(`Could not fetch Alinea source pack (${response.status})`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (response.status === 200) {
      this.#complete = bytes
      if (start + length > bytes.byteLength)
        throw new Error('Alinea source pack range exceeds pack bounds')
      return bytes.subarray(start, start + length)
    }
    if (bytes.byteLength !== length)
      throw new Error('Invalid Alinea source pack range response')
    return bytes
  }

  async #loadIndex(): Promise<SourcePackIndex> {
    this.#index ??= (async () => {
      const header = parseSourcePackHeader(
        await this.#range(0, SOURCE_PACK_HEADER_SIZE)
      )
      const index = await this.#range(header.indexOffset, header.indexLength)
      return parseSourcePackIndex(index, header.indexRawLength)
    })()
    return this.#index
  }

  async #materialize(): Promise<MemorySource> {
    if (this.#memory) return this.#memory
    const index = await this.#loadIndex()
    const blobs = new Map<string, Uint8Array>()
    for await (const [sha, blob] of this.getBlobs(Object.keys(index.objects)))
      blobs.set(sha, blob)
    this.#memory = new MemorySource(new ReadonlyTree(index.tree), blobs)
    return this.#memory
  }

  async getTree() {
    if (this.#memory) return this.#memory.getTree()
    return new ReadonlyTree((await this.#loadIndex()).tree)
  }

  async getTreeIfDifferent(sha: string) {
    if (this.#memory) return this.#memory.getTreeIfDifferent(sha)
    const tree = await this.getTree()
    return tree.sha === sha ? undefined : tree
  }

  async *getBlobs(shas: Array<string>) {
    if (this.#memory) {
      yield* this.#memory.getBlobs(shas)
      return
    }
    const index = await this.#loadIndex()
    const requested = shas.map(sha => {
      const object = index.objects[sha]
      if (!object) throw new Error(`Missing source pack object: ${sha}`)
      return {sha, ...object}
    })
    requested.sort((left, right) => left.offset - right.offset)
    for (const group of groupFrames(requested)) {
      const start = group[0].offset
      const last = group.at(-1)!
      const bytes = await this.#range(start, last.offset + last.length - start)
      for (const object of group) {
        const frameStart = object.offset - start
        const frame = bytes.subarray(frameStart, frameStart + object.length)
        const blob = await decompressSourcePackFrame(frame, object.rawLength)
        if ((await hashBlob(blob)) !== object.sha)
          throw new Error(
            `Alinea source pack object hash mismatch: ${object.sha}`
          )
        yield [object.sha, blob] as [string, Uint8Array]
      }
    }
  }

  async applyChanges(batch: Parameters<Source['applyChanges']>[0]) {
    return (await this.#materialize()).applyChanges(batch)
  }
}

interface PackedFrame {
  sha: string
  offset: number
  length: number
  rawLength: number
}

function groupFrames(frames: Array<PackedFrame>): Array<Array<PackedFrame>> {
  const maxGap = 32 * 1024
  const maxRange = 1024 * 1024
  const result: Array<Array<PackedFrame>> = []
  for (const frame of frames) {
    const current = result.at(-1)
    const first = current?.[0]
    const last = current?.at(-1)
    const gap = last ? frame.offset - (last.offset + last.length) : 0
    const range = first ? frame.offset + frame.length - first.offset : 0
    if (!current || gap > maxGap || range > maxRange) result.push([frame])
    else current.push(frame)
  }
  return result
}

export async function fetchGeneratedSource(baseUrl: URL): Promise<Source> {
  const sourceFile = await generatedSourceFile()
  return new PackedSource(new URL(sourceFile, baseUrl))
}
