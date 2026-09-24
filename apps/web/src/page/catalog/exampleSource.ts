import {readFileSync} from 'node:fs'
import path from 'node:path'
import {cache} from 'react'
import type {ComponentExampleId} from './componentCatalog'

/** The source of an example, as shown next to its preview */
export const exampleSource = cache(function exampleSource(
  id: ComponentExampleId
): string {
  try {
    const file = path.join(
      process.cwd(),
      'src/page/catalog/examples',
      `${id}.tsx`
    )
    return readFileSync(file, 'utf8')
      .replace(/^'use client'\s*/, '')
      .trim()
  } catch {
    return ''
  }
})
