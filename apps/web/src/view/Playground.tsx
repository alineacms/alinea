// @ts-ignore
import declarations from '!!raw-loader!../data/alinea.d.ts.txt'
import * as core from '@alinea/core'
import {Field, outcome, TypeConfig} from '@alinea/core'
import {DashboardProvider, SessionProvider, Toolbar} from '@alinea/dashboard'
import {createDemo} from '@alinea/dashboard/demo/DemoData'
import {EntrySummaryProvider} from '@alinea/dashboard/hook/UseEntrySummary'
import * as editor from '@alinea/editor'
import {InputForm, useField} from '@alinea/editor'
import {useForm} from '@alinea/editor/hook/UseForm'
import {InputField} from '@alinea/editor/view/InputField'
import {QueryClient, QueryClientProvider} from '@alinea/shared/react-query'
import {
  ErrorBoundary,
  fromModule,
  HStack,
  Loader,
  Pane,
  PreferencesProvider,
  px,
  Stack,
  TextLabel,
  Typo,
  Viewport,
  VStack
} from '@alinea/ui'
import {Main} from '@alinea/ui/Main'
import Editor, {Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import esbuild, {BuildFailure, Message, Plugin} from 'esbuild-wasm'
import esbuildPkg from 'esbuild-wasm/package.json'
import lzstring from 'lz-string'
import Head from 'next/head'
import Link from 'next/link'
import * as React from 'react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {useClipboard} from 'use-clipboard-copy'
import {FavIcon} from './layout/branding/FavIcon'
import {Logo} from './layout/branding/Logo'
import css from './Playground.module.scss'

const styles = fromModule(css)

const defaultValue = `import {alinea} from 'alinea'

export default alinea.type('Type', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5})
})`

const global: any = window
Object.assign(global, {
  alinea,
  React,
  '@alinea/core': core,
  '@alinea/editor': editor
})

const alineaPlugin: Plugin = {
  name: 'alinea',
  setup(build) {
    build.onResolve({filter: /.*/}, args => {
      return {
        path: args.path,
        namespace: 'alinea'
      }
    })
    build.onLoad({filter: /.*/, namespace: 'alinea'}, args => {
      const pkg = args.path
      return {
        contents: `module.exports = global['${pkg}']`,
        loader: 'js'
      }
    })
  }
}

type PreviewTypeProps = {
  type: TypeConfig
}

function PreviewType({type}: PreviewTypeProps) {
  const state = useRef<any>()
  const form = useForm({type, initialValue: state.current}, [type])
  state.current = form()
  return (
    <>
      <Typo.H1>
        <TextLabel label={type.label} />
      </Typo.H1>

      <InputForm {...form} />
    </>
  )
}

type PreviewFieldProps = {
  field: Field<any, any>
}

function PreviewField({field}: PreviewFieldProps) {
  const input = useField(field, [field])
  return (
    <div style={{margin: 'auto', width: '100%'}}>
      <InputField {...input} />
    </div>
  )
}

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

function editorConfig(monaco: Monaco) {
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    jsx: 'preserve'
  })
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    declarations,
    '@types/alinea/index.d.ts'
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
      path="alinea.config.tsx"
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

export default function Playground() {
  const [view, setView] = useState<'both' | 'preview' | 'source'>(() => {
    const url = new URL(location.href)
    return (url.searchParams.get('view') as any) || 'both'
  })
  const persistenceId = '@alinea/web/playground'
  const init = useMemo(async () => {
    // This fails during development when we hot reload
    return outcome(() =>
      esbuild.initialize({
        wasmURL: `https://cdn.jsdelivr.net/npm/esbuild-wasm@${esbuildPkg.version}/esbuild.wasm`
      })
    )
  }, [])
  const {client, config, session} = useMemo(createDemo, [])
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
  const [errors, setErrors] = useState<Array<Message>>([])
  const [result, setResult] = useState<
    TypeConfig | Field<any, any> | undefined
  >()
  const clipboard = useClipboard({
    copiedTimeout: 1200
  })
  function handleBuildErrors(failure: BuildFailure) {
    setErrors(failure.errors)
  }
  async function compile(code: string) {
    // Todo: we could use the monaco typescript worker to compile code and
    // save 2-3MB but we'd have to figure out how to rewrite the imports
    // Or, use babel standalone which seems to be around 300kb:
    // Example: https://github.com/ariakit/ariakit/blob/3c74257c9eaa35b8e21c26718ac8be670087d390/packages/ariakit-playground/src/__utils/compile-module.ts
    const compiled = await esbuild
      .build({
        platform: 'browser',
        bundle: true,
        write: false,
        format: 'iife',
        globalName: '_contentScriptReturn',
        footer: {js: '_contentScriptReturn.default'},
        stdin: {
          contents: code,
          sourcefile: 'alinea.config.tsx',
          loader: 'tsx'
        },
        plugins: [alineaPlugin]
      })
      .catch(handleBuildErrors)
    if (!compiled) return
    try {
      setErrors([])
      setResult(eval(compiled.outputFiles[0].text))
    } catch (e) {
      setErrors([{text: String(e)} as any])
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
    init.then(() => compile(code))
  }, [code])
  return (
    <>
      <FavIcon color="#4a65e8" />
      <Head>
        <title>Alinea CMS playground</title>
        <meta name="theme-color" content="#4a65e8" />
        <style>{`#__next {height: 100%}`}</style>
      </Head>
      <PreferencesProvider>
        <Viewport
          attachToBody
          color="#5661E5"
          contain
          className={styles.root(view)}
        >
          <DashboardProvider value={{client, config}}>
            <SessionProvider value={session}>
              <QueryClientProvider client={queryClient}>
                <EntrySummaryProvider>
                  <Toolbar.Provider>
                    {clipboard.copied && (
                      <div className={styles.root.flash()}>
                        <p className={styles.root.flash.msg()}>
                          URL copied to clipboard
                        </p>
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

                        <div
                          style={{
                            position: 'relative',
                            flex: '1 0 0',
                            display: view === 'source' ? 'none' : 'block',
                            overflow: 'auto'
                          }}
                        >
                          <VStack style={{height: '100%'}}>
                            <div className={styles.root.header()}>
                              <Toolbar.Portal />
                            </div>
                            <ErrorBoundary dependencies={[result]}>
                              <Main>
                                <Main.Container
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%',
                                    paddingTop: 0
                                  }}
                                >
                                  {!result ? (
                                    errors.length === 0 && <Loader absolute />
                                  ) : result instanceof TypeConfig ? (
                                    <PreviewType type={result} />
                                  ) : (
                                    <PreviewField field={result} />
                                  )}
                                </Main.Container>
                              </Main>
                            </ErrorBoundary>
                            {errors.length > 0 && (
                              <div className={styles.root.errors()}>
                                <VStack gap={20}>
                                  {errors.map(error => {
                                    return (
                                      <Typo.Monospace as="div">
                                        <p>{error.text}</p>
                                        {error.location && (
                                          <div style={{paddingLeft: px(10)}}>
                                            <>
                                              <b>
                                                [{error.location.file}:{' '}
                                                {error.location.line}]
                                              </b>
                                              <div>
                                                {error.location.lineText}
                                              </div>
                                            </>
                                          </div>
                                        )}
                                      </Typo.Monospace>
                                    )
                                  })}
                                </VStack>
                              </div>
                            )}
                          </VStack>
                        </div>
                      </HStack>

                      <footer className={styles.root.footer()}>
                        <Link href="/">
                          <a className={styles.root.logo()}>
                            <Logo />
                          </a>
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
                  </Toolbar.Provider>
                </EntrySummaryProvider>
              </QueryClientProvider>
            </SessionProvider>
          </DashboardProvider>
        </Viewport>
      </PreferencesProvider>
    </>
  )
}
