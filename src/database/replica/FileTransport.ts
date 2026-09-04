import {open} from 'node:fs/promises'
import type {ByteRangeSource} from './Bundle.js'

export class FileRangeSource implements ByteRangeSource {
  constructor(readonly location: string) {}

  async read(
    offset: number,
    length: number,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    signal?.throwIfAborted()
    const file = await open(this.location, 'r')
    try {
      const contents = new Uint8Array(length)
      const {bytesRead} = await file.read(contents, 0, length, offset)
      signal?.throwIfAborted()
      return bytesRead === length ? contents : contents.slice(0, bytesRead)
    } finally {
      await file.close()
    }
  }
}
