'use client'

import styler from '@alinea/styler'
import Editor, {type Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import * as core from 'alinea/core'
import {Field} from 'alinea/core/Field'
import {outcome} from 'alinea/core/Outcome'
import {trigger} from 'alinea/core/Trigger'
import {Type, type} from 'alinea/core/Type'
import * as dashboard from 'alinea/dashboard'
import {Logo} from '@/layout/branding/Logo'
import 'alinea/css'
import {Loader} from '@/layout/Loader'
import {HStack, VStack} from 'alinea/ui'
import {Stack} from '@/layout/Stack'
import lzstring from 'lz-string'
import Link from 'next/link'
import Script from 'next/script'
import * as React from 'react'
import {Suspense, useEffect, useRef, useState} from 'react'
import type typescript from 'typescript'
import {useClipboard} from 'use-clipboard-copy'
import css from './Playground.module.scss'

const styles = styler(css)

const defaultValue = `import {Config, Field} from 'alinea'

export default Config.type('Type', {
  fields: {
    title: Field.text('Title', {width: 0.5}),
    path: Field.path('Path', {width: 0.5})
  }
})`

function PreviewFieldRow({name, field}: {name: string; field: Field}) {
  const view = Field.view(field)
  return (
    <div className={styles.root.field()}>
      <span className={styles.root.field.label()}>{Field.label(field)}</span>
      <code className={styles.root.field.key()}>{name}</code>
      {typeof view === 'string' && (
        <code className={styles.root.field.type()}>{view}</code>
      )}
    </div>
  )
}

type PreviewTypeProps = {
  type: Type
}

function PreviewType({type}: PreviewTypeProps) {
  const fields = Type.fields(type)
  return (
    <div className={styles.root.preview()}>
      <h1 className={styles.root.preview.title()}>{Type.label(type)}</h1>
      {Object.entries(fields).map(([name, field]) => (
        <PreviewFieldRow key={name} name={name} field={field} />
      ))}
    </div>
  )
}

type PreviewFieldProps = {
  field: Field<any, any>
}

function PreviewField({field}: PreviewFieldProps) {
  const view = Field.view(field)
  return (
    <div className={styles.root.preview()}>
      <h1 className={styles.root.preview.title()}>{Field.label(field)}</h1>
      {typeof view === 'string' && (
        <code className={styles.root.field.type()}>{view}</code>
      )}
    </div>
  )
}

function editorConfig(declarations: string, monaco: Monaco) {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: 'preserve' as any,
    typeRoots: ['node_modules/@types']
  })
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `declare var alinea: typeof import('alinea').alinea;\n${declarations}`,
    'file:///node_modules/@types/alinea/index.d.ts'
  )
}

interface SourceEditorProps {
  declarations: string
  resizeable: boolean
  code: string
  setCode: (code: string) => void
}

function SourceEditor({
  declarations,
  resizeable,
  code,
  setCode
}: SourceEditorProps) {
  const inner = (
    <Editor
      // theme="vs-dark"
      path="cms.ts"
      defaultLanguage="typescript"
      value={code}
      beforeMount={editorConfig.bind(null, declarations)}
      onChange={value => {
        if (value) setCode(value)
      }}
      loading={<Loader absolute />}
    />
  )
  if (!resizeable) return inner
  return <div className={styles.root.editor()}>{inner}</div>
}

const ts = trigger<typeof typescript>()

export interface PlaygroundProps {
  declarations: string
}

export default function Playground({declarations}: PlaygroundProps) {
  const [view, setView] = useState<'both' | 'preview' | 'source'>(() => {
    const url = new URL(location.href)
    return (url.searchParams.get('view') as any) || 'both'
  })
  const persistenceId = '@alinea/web/playground'
  const [code, storeCode] = useState<string>(() => {
    const [fromUrl] = outcome(() =>
      lzstring.decompressFromEncodedURIComponent(
        location.hash.slice('#code/'.length)
      )
    )
    if (fromUrl) return fromUrl
    const [fromStorage] = outcome(() =>
      window.localStorage.getItem(persistenceId)
    )
    if (fromStorage) return fromStorage
    return defaultValue
  })
  function setCode(code: string) {
    outcome(() => window.localStorage.setItem(persistenceId, code))
    storeCode(code)
  }
  const [state, setState] = useState<{
    result?: Type | Field<any, any>
    error?: Error
  }>({})
  const clipboard = useClipboard({
    copiedTimeout: 1200
  })
  async function compile(code: string) {
    try {
      const {transpileModule, JsxEmit, ScriptTarget, ModuleKind} = await ts
      const body = transpileModule(code, {
        compilerOptions: {
          jsx: JsxEmit.React,
          target: ScriptTarget.ES2022,
          module: ModuleKind.CommonJS
        }
      })
      const exec = new Function(
        'require',
        'exports',
        'React',
        'alinea',
        body.outputText
      )
      const exports = Object.create(null)
      const pkgs: Record<string, unknown> = {
        alinea,
        React,
        'alinea/core': core,
        'alinea/dashboard': dashboard
      }
      const require = (name: string) => pkgs[name]
      exec(require, exports, React, alinea)
      setState({result: exports.default})
    } catch (error) {
      setState({...state, error: error as Error})
    }
  }
  function handleShare() {
    window.location.hash = `#code/${lzstring.compressToEncodedURIComponent(code)}`
    clipboard.copy(window.location.href)
  }
  function handleReset() {
    setCode(defaultValue)
    window.location.hash = ''
  }
  useEffect(() => {
    compile(code)
  }, [code])
  if (state.error) console.error(state.error)
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/typescript@5.1.3/lib/typescript.min.js"
        onLoad={() => {
          ts.resolve((window as any).ts)
        }}
      />
      <div className={styles.root(view)}>
        {clipboard.copied && (
          <div className={styles.root.flash()}>
            <p className={styles.root.flash.msg()}>URL copied to clipboard</p>
          </div>
        )}
        <VStack style={{height: '100%'}}>
          <HStack style={{height: '100%', minHeight: 0}}>
            {view !== 'preview' && (
              <SourceEditor
                declarations={declarations}
                code={code}
                setCode={setCode}
                resizeable={view === 'both'}
              />
            )}

            {view !== 'source' && (
              <Suspense fallback={<Loader absolute />}>
                <div className={styles.root.previewPane()}>
                  {state.error ? (
                    <div className={styles.root.errors()}>
                      <VStack gap={20}>
                        <p>{state.error.message}</p>
                      </VStack>
                    </div>
                  ) : Type.isType(state.result) ? (
                    <PreviewType type={state.result} />
                  ) : state.result ? (
                    <PreviewField field={state.result} />
                  ) : (
                    <Loader absolute />
                  )}
                </div>
              </Suspense>
            )}
          </HStack>

          <footer className={styles.root.footer()}>
            <Link href="/" className={styles.root.logo()} target="_top">
              <Logo />
            </Link>
            <button
              type="button"
              className={styles.root.footer.button({
                active: view === 'source'
              })}
              onClick={() => setView('source')}
            >
              Editor
            </button>
            <button
              type="button"
              className={styles.root.footer.button({
                active: view === 'preview'
              })}
              onClick={() => setView('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              className={styles.root.footer.button({
                active: view === 'both'
              })}
              onClick={() => setView('both')}
            >
              Both
            </button>
            <Stack.Center />
            <button
              type="button"
              className={styles.root.footer.button()}
              onClick={handleShare}
            >
              Copy url
            </button>
            {window.top === window.self ? (
              <button
                type="button"
                className={styles.root.footer.button()}
                onClick={handleReset}
              >
                Reset
              </button>
            ) : (
              <a
                className={styles.root.footer.button()}
                href={location.href}
                target="_blank"
                rel="noreferrer"
              >
                Open in new tab
              </a>
            )}
          </footer>
        </VStack>
      </div>
    </>
  )
}