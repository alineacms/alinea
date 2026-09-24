'use client'

import styler from '@alinea/styler'
import Editor, {type Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import * as core from 'alinea/core'
import {Field} from 'alinea/core/Field'
import {outcome} from 'alinea/core/Outcome'
import type {ExportedSource} from 'alinea/core/source/SourceExport'
import {trigger} from 'alinea/core/Trigger'
import {Type, type} from 'alinea/core/Type'
import * as cms from 'alinea/cms'
import * as components from 'alinea/components'
import * as config from 'alinea/config'
import * as dashboard from 'alinea/dashboard'
import {NodeEditor} from 'alinea/dashboard/app/EntryFields'
import {ReactiveNode} from 'alinea/dashboard/atoms/ReactiveNode'
import * as dashboardHooks from 'alinea/dashboard/hooks'
import {StoryProvider} from 'alinea/dashboard/StoryProvider'
import * as edit from 'alinea/edit'
import * as field from 'alinea/field'
import {views} from 'alinea/field/views'
import * as query from 'alinea/query'
import {Logo} from '@/layout/branding/Logo'
import {setupDemo} from '@/page/demo/demoSetup'
import 'alinea/css'
import {Loader} from '@/layout/Loader'
import {HStack, VStack} from 'alinea/ui'
import {Stack} from '@/layout/Stack'
import lzstring from 'lz-string'
import Link from 'next/link'
import Script from 'next/script'
import * as React from 'react'
import {Suspense, use, useEffect, useState} from 'react'
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

interface PreviewTypeProps {
  type: Type
}

function PreviewType({type}: PreviewTypeProps) {
  // A fresh form for every compiled type, seeded with the field initial values
  const node = React.useMemo(
    () => new ReactiveNode(Type.initialValue(type) as object),
    [type]
  )
  return (
    <div className={styles.root.preview()}>
      <h1 className={styles.root.preview.title()}>{Type.label(type)}</h1>
      <NodeEditor node={node} type={type} />
    </div>
  )
}

interface PreviewFieldProps {
  field: Field
}

function PreviewField({field}: PreviewFieldProps) {
  const formType = React.useMemo(
    () => type(Field.label(field), {fields: {field}}),
    [field]
  )
  return <PreviewType type={formType} />
}

interface PreviewErrorProps {
  error: Error
}

function PreviewError({error}: PreviewErrorProps) {
  return (
    <div className={styles.root.errors()}>
      <VStack gap={20}>
        <p>{error.message}</p>
      </VStack>
    </div>
  )
}

interface PreviewBoundaryProps {
  result: unknown
  children: React.ReactNode
}

interface PreviewBoundaryState {
  error?: Error
  result?: unknown
}

// Field views can throw while rendering an unexpected configuration, show the
// error instead of unmounting the editor, and retry once the code changes
class PreviewBoundary extends React.Component<
  PreviewBoundaryProps,
  PreviewBoundaryState
> {
  state: PreviewBoundaryState = {}
  static getDerivedStateFromError(error: Error): PreviewBoundaryState {
    return {error}
  }
  static getDerivedStateFromProps(
    props: PreviewBoundaryProps,
    state: PreviewBoundaryState
  ): PreviewBoundaryState | null {
    if (props.result === state.result) return null
    return {result: props.result, error: undefined}
  }
  render() {
    if (this.state.error) return <PreviewError error={this.state.error} />
    return this.props.children
  }
}

interface PreviewProviderProps {
  demo: ReturnType<typeof setupDemo>
  children: React.ReactNode
}

// Previews run against the in-browser Oak & Loom demo backend, so link fields
// can pick its pages and images
function PreviewProvider({demo, children}: PreviewProviderProps) {
  const {config, client, db, events} = use(demo)
  return (
    <StoryProvider
      config={config}
      client={client}
      graph={db}
      events={events}
      views={views}
    >
      {children}
    </StoryProvider>
  )
}

function editorConfig(declarations: string, monaco: Monaco) {
  const {typescript} = monaco.languages
  typescript.typescriptDefaults.setCompilerOptions({
    jsx: typescript.JsxEmit.React,
    target: typescript.ScriptTarget.ES2022,
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    allowNonTsExtensions: true,
    typeRoots: ['node_modules/@types']
  })
  typescript.typescriptDefaults.addExtraLib(
    // Example code runs with React and alinea in scope, see compile()
    `declare var React: typeof import('react');\ndeclare var alinea: typeof import('alinea');\n${declarations}`,
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
      path="cms.tsx"
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

type PlaygroundView = 'both' | 'preview' | 'source'

export interface PlaygroundProps {
  declarations: string
  exported: ExportedSource
}

export default function Playground({declarations, exported}: PlaygroundProps) {
  const demo = React.useMemo(() => setupDemo(exported), [exported])
  const [view, setView] = useState<PlaygroundView>(() => {
    const url = new URL(location.href)
    const view = url.searchParams.get('view')
    return view === 'preview' || view === 'source' ? view : 'both'
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
    result?: unknown
    error?: Error
  }>({})
  const clipboard = useClipboard({
    copiedTimeout: 1200
  })
  async function compile(code: string) {
    try {
      const {transpileModule, JsxEmit, ScriptTarget, ModuleKind} = await ts
      const body = transpileModule(code, {
        fileName: 'cms.tsx',
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
        react: React,
        'alinea/cms': cms,
        'alinea/components': components,
        'alinea/config': config,
        'alinea/core': core,
        'alinea/dashboard': dashboard,
        'alinea/dashboard/hooks': dashboardHooks,
        'alinea/edit': edit,
        'alinea/field': field,
        'alinea/query': query
      }
      const require = (name: string) => {
        if (name in pkgs) return pkgs[name]
        throw new Error(`Cannot import "${name}" in the playground`)
      }
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
          ts.resolve((window as unknown as {ts: typeof typescript}).ts)
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
                <PreviewProvider demo={demo}>
                  <div className={styles.root.previewPane()}>
                    {state.error ? (
                      <PreviewError error={state.error} />
                    ) : (
                      <PreviewBoundary result={state.result}>
                        {Type.isType(state.result) ? (
                          <PreviewType type={state.result} />
                        ) : Field.isField(state.result) ? (
                          <PreviewField field={state.result} />
                        ) : state.result === undefined ? (
                          <Loader absolute />
                        ) : (
                          <PreviewError
                            error={
                              new Error(
                                'Export a type or a field as the default export'
                              )
                            }
                          />
                        )}
                      </PreviewBoundary>
                    )}
                  </div>
                </PreviewProvider>
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
