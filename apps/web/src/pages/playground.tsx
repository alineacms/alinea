import {outcome} from '@alinea/core'
import {Loader} from '@alinea/ui'
import {bundle} from 'dts-bundle'
import fs from 'fs-extra'
import dynamic from 'next/dynamic'
import {Suspense} from 'react'
import path from 'node:path'

const PlaygroundPage = dynamic(() => import('../view/Playground'), {
  ssr: false
})

export async function getStaticProps() {
  const root = '../../dist'
  const pkgs = await fs.readdir(root)
  for (const pkg of pkgs) {
    if (await outcome.fails(fs.stat(path.join(root, `${pkg}/src/index.d.ts`))))
      continue
    console.log(path.join(root, `${pkg}.d.ts`))
    await bundle({
      name: pkg === 'alinea' ? 'alinea' : `@alinea/${pkg}`,
      main: path.join(root, `${pkg}/src/index.d.ts`),
      out: path.join(root, `${pkg}.d.ts`)
    })
  }
}

export default function Playground() {
  return (
    <Suspense fallback={<Loader absolute />}>
      <PlaygroundPage />
    </Suspense>
  )
}
