'use client'

// @ts-ignore
import declarations from '!!raw-loader!./alinea.d.ts.txt'
import {Logo} from '@/layout/branding/Logo'
import styler from '@alinea/styler'
import Editor, {Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import {createExample} from 'alinea/backend/test/Example'
import * as core from 'alinea/core'
import {Field} from 'alinea/core/Field'
import {outcome} from 'alinea/core/Outcome'
import {trigger} from 'alinea/core/Trigger'
import {Type, type} from 'alinea/core/Type'
import 'alinea/css'
import * as dashboard from 'alinea/dashboard'
import {DashboardProvider} from 'alinea/dashboard/DashboardProvider'
import {defaultViews} from 'alinea/dashboard/editor/DefaultViews'
import {InputForm} from 'alinea/dashboard/editor/InputForm'
import {ErrorBoundary} from 'alinea/dashboard/view/ErrorBoundary'
import {Viewport} from 'alinea/dashboard/view/Viewport'
import {FieldToolbar} from 'alinea/dashboard/view/entry/FieldToolbar'
import {HStack, Loader, Stack, TextLabel, Typo, VStack} from 'alinea/ui'
import {Main} from 'alinea/ui/Main'
import {Pane} from 'alinea/ui/Pane'
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

type PreviewTypeProps = {
  type: Type
}

function PreviewType({type}: PreviewTypeProps) {
  const state = useRef<any>()
  const form = dashboard.useForm(type, {initialValue: state.current})
  state.current = form.data()
  const label = Type.label(type)
  return (
    <div style={{margin: 'auto', width: '100%', padding: `20px 0`}}>
      <Typo.H1>
        <TextLabel label={label} />
      </Typo.H1>

      <InputForm form={form} />
    </div>
  )
}

type PreviewFieldProps = {
  field: Field<any, any>
}

function PreviewField({field}: PreviewFieldProps) {
  const formType = React.useMemo(
    () => type('Preview', {fields: {field}}),
    [field]
  )
  const form = dashboard.useForm(formType)
  return (
    <div style={{margin: 'auto', width: '100%'}}>
      <InputForm form={form} />
    </div>
  )
}

function editorConfig(monaco: Monaco) {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: 'preserve',
    typeRoots: ['node_modules/@types']
  })
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    `declare var alinea: typeof import('alinea').alinea;\n` + declarations,
    'file:///node_modules/@types/alinea/index.d.ts'
  )
}

interface SourceEditorProps {
  resizeable: boolean
  code: string
  setCode: (code: string) => void
}

function SourceEditor({resizeable, code, setCode}: SourceEditorProps) {
  const inner = (
    <Editor
      // theme="vs-dark"
      path="cms.tsx"
      defaultLanguage="typescript"
      value={code}
      beforeMount={editorConfig}
      onChange={value => {
        if (value) setCode(value)
      }}
      loading={<Loader absolute />}
    />
  )
  if (!resizeable) return inner
  return (
    <Pane
      id="editor"
      resizable="right"
      defaultWidth={window.innerWidth * 0.5}
      maxWidth={window.innerWidth * 0.8}
      className={styles.root.editor()}
    >
      {inner}
    </Pane>
  )
}

const ts = trigger<typeof typescript>()
const example = createExample()
const connection = example.connect()

export default function Playground() {
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
      const pkgs = {
        alinea,
        React,
        'alinea/core': core,
        'alinea/dashboard': dashboard
      }
      const require = (name: string) => pkgs[name]
      exec(require, exports, React, alinea)
      setState({result: exports.default})
    } catch (error) {
      setState({...state, error})
    }
  }
  function handleShare() {
    window.location.hash =
      '#code/' + lzstring.compressToEncodedURIComponent(code)
    clipboard.copy(window.location.href)
  }
  function handleReset() {
    setCode(defaultValue)
    window.location.hash = ''
  }
  useEffect(() => {
    compile(code)
  }, [code])
  const client = React.use(connection)
  if (state.error) console.error(state.error)
  return (
    <DashboardProvider
      dev
      client={client}
      config={example.config}
      views={defaultViews}
    >
      <Script
        src="https://cdn.jsdelivr.net/npm/typescript@5.1.3/lib/typescript.min.js"
        onLoad={() => {
          ts.resolve((window as any).ts)
        }}
      />
      <Viewport
        attachToBody
        contain
        color="#5661E5"
        className={styles.root(view)}
      >
        <FieldToolbar.Provider>
          {clipboard.copied && (
            <div className={styles.root.flash()}>
              <p className={styles.root.flash.msg()}>URL copied to clipboard</p>
            </div>
          )}
          <VStack style={{height: '100%'}}>
            <HStack style={{height: '100%', minHeight: 0}}>
              {view !== 'preview' && (
                <SourceEditor
                  code={code}
                  setCode={setCode}
                  resizeable={view === 'both'}
                />
              )}

              {view !== 'source' && (
                <Suspense fallback={<Loader absolute />}>
                  <ErrorBoundary dependencies={[state.result]}>
                    <Main>
                      <Main.Container>
                        {!state.result ? (
                          state.error && <Loader absolute />
                        ) : Type.isType(state.result) ? (
                          <PreviewType type={state.result} />
                        ) : (
                          <PreviewField field={state.result} />
                        )}

                        {state.error && (
                          <div className={styles.root.errors()}>
                            <VStack gap={20}>
                              <Typo.Monospace as="div">
                                <p>{state.error.message}</p>
                              </Typo.Monospace>
                            </VStack>
                          </div>
                        )}
                      </Main.Container>
                      <FieldToolbar.Root />
                    </Main>
                  </ErrorBoundary>
                </Suspense>
              )}
            </HStack>

            <footer className={styles.root.footer()}>
              <Link href="/" className={styles.root.logo()} target="_top">
                <Logo />
              </Link>
              <button
                className={styles.root.footer.button({
                  active: view === 'source'
                })}
                onClick={() => setView('source')}
              >
                Editor
              </button>
              <button
                className={styles.root.footer.button({
                  active: view === 'preview'
                })}
                onClick={() => setView('preview')}
              >
                Preview
              </button>
              <button
                className={styles.root.footer.button({
                  active: view === 'both'
                })}
                onClick={() => setView('both')}
              >
                Both
              </button>
              <Stack.Center />
              <button
                className={styles.root.footer.button()}
                onClick={handleShare}
              >
                Copy url
              </button>
              {window.top === window.self ? (
                <button
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
                >
                  Open in new tab
                </a>
              )}
            </footer>
          </VStack>
        </FieldToolbar.Provider>
      </Viewport>
    </DashboardProvider>
  )
}
