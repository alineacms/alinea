'use client'

import styler from '@alinea/styler'
import {useEffect, useState} from 'react'
import {Loader} from '@/layout/Loader'
import {Lab} from './Lab'
import type {LabEngine} from './labEngine'
import css from './LabLoader.module.scss'

const styles = styler(css)

interface EngineModule {
  engine: LabEngine
  start(): Promise<void>
}

/** Where `bun lab:build` writes the engine, served from the public dir */
const engineUrl = '/lab/engine.js'

export default function LabLoader() {
  const [engine, setEngine] = useState<LabEngine>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let active = true
    // The engine is built on its own: the bundler must leave it alone
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ engineUrl)
      .then(async (module: EngineModule) => {
        await module.start()
        if (active) setEngine(module.engine)
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      active = false
    }
  }, [])
  if (error)
    return (
      <div className={styles.LabLoader()}>
        <p>The lab could not start: {error}</p>
        <p className={styles.LabLoader.hint()}>
          Its engine is built separately: run <code>bun lab:build</code> in the
          repository.
        </p>
      </div>
    )
  if (!engine)
    return (
      <div className={styles.LabLoader()}>
        <Loader />
        <p className={styles.LabLoader.hint()}>
          Building a repository, generating its database and deploying it…
        </p>
      </div>
    )
  return <Lab engine={engine} />
}
