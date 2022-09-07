import declarations from '!!raw-loader!../data/alinea.d.ts'
import {outcome, TypeConfig} from '@alinea/core'
import {base64url} from '@alinea/core/util/Encoding'
import {DashboardProvider, SessionProvider, Toolbar} from '@alinea/dashboard'
import {createDemo} from '@alinea/dashboard/demo/DemoData'
import {EntrySummaryProvider} from '@alinea/dashboard/hook/UseEntrySummary'
import {InputForm} from '@alinea/editor'
import {useForm} from '@alinea/editor/hook/UseForm'
import {QueryClient, QueryClientProvider} from '@alinea/shared/react-query'
import {
  AppBar,
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
import {IcOutlineScreenshot} from '@alinea/ui/icons/IcOutlineScreenshot'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundCode} from '@alinea/ui/icons/IcRoundCode'
import {IcRoundShare} from '@alinea/ui/icons/IcRoundShare'
import {Main} from '@alinea/ui/Main'
import Editor, {Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import esbuild, {BuildFailure, Message, Plugin} from 'esbuild-wasm'
import esbuildPkg from 'esbuild-wasm/package.json'
import Head from 'next/head'
import Link from 'next/link'
import * as React from 'react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {useClipboard} from 'use-clipboard-copy'
import {Logo} from './layout/branding/Logo'
import css from './Playground.module.scss'

const styles = fromModule(css)

const defaultValue = `import {alinea} from 'alinea'

export default alinea.type('Type', {
  title: alinea.text('Title', {width: 0.5}),
  path: alinea.path('Path', {width: 0.5})
})`

const global: any = window
global['alinea'] = alinea
global['React'] = React

const alineaPlugin: Plugin = {
  name: 'alinea',
  setup(build) {
    build.onResolve({filter: /^alinea$/}, args => {
      return {
        path: args.path,
        namespace: 'alinea'
      }
    })
    build.onLoad({filter: /^alinea$/, namespace: 'alinea'}, args => {
      return {
        contents: 'module.exports = window.alinea',
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

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export default function Playground() {
  const persistenceId = '@alinea/web/playground'
  const init = useMemo(async () => {
    // This fails during development when we hot reload
    return outcome(() =>
      esbuild.initialize({
        wasmURL: `https://cdn.jsdelivr.net/npm/esbuild-wasm@${esbuildPkg.version}/esbuild.wasm`
      })
    )
  }, [])
  const [previewing, setPreviewing] = useState(true)
  function togglePreview() {
    setPreviewing(!previewing)
  }
  const {client, config, session} = useMemo(createDemo, [])
  const [code, storeCode] = useState<string>(() => {
    const [fromUrl] = outcome(() =>
      new TextDecoder().decode(
        base64url.parse(window.location.hash.slice('#code/'.length))
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
  const [type, setType] = useState<TypeConfig | undefined>()
  const clipboard = useClipboard({
    copiedTimeout: 1200
  })
  function handleBuildErrors(failure: BuildFailure) {
    setErrors(failure.errors)
  }
  function editorConfig(monaco: Monaco) {
    console.log('config')
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: 'preserve'
    })
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      declarations,
      '@types/alinea/index.d.ts'
    )
  }
  async function compile(code: string) {
    // Todo: we could use the monaco typescript worker to compile code and
    // save 2-3MB but we'd have to figure out how to rewrite the imports
    const result = await esbuild
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
    if (!result) return
    try {
      setErrors([])
      setType(eval(result.outputFiles[0].text))
    } catch (e) {
      setErrors([{text: String(e)} as any])
    }
  }
  function handleShare() {
    window.location.hash =
      '#code/' + base64url.stringify(new TextEncoder().encode(code))
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
      <Head>
        <style>{`#__next {height: 100%}`}</style>
      </Head>
      <PreferencesProvider>
        <Viewport
          attachToBody
          color="#5661E5"
          contain
          className={styles.root({previewing})}
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
                      <AppBar.Root
                        style={{
                          borderBottom: `1px solid var(--alinea-outline)`
                        }}
                      >
                        <div className={styles.root.logo()}>
                          <Link href="/">
                            <a>
                              <Logo />
                            </a>
                          </Link>
                        </div>

                        <Stack.Center style={{paddingLeft: px(18)}}>
                          <Toolbar.Portal />
                        </Stack.Center>
                        <AppBar.Item
                          as="button"
                          icon={IcRoundClose}
                          onClick={handleReset}
                        >
                          Reset
                        </AppBar.Item>
                        <AppBar.Item
                          as="button"
                          icon={IcRoundShare}
                          onClick={handleShare}
                        >
                          Share
                        </AppBar.Item>
                        <div className={styles.root.mobileMenu()}>
                          <AppBar.Item
                            as="button"
                            icon={
                              previewing ? IcRoundCode : IcOutlineScreenshot
                            }
                            onClick={togglePreview}
                          >
                            <div style={{width: px(50)}}>
                              {previewing ? 'Source' : 'Preview'}
                            </div>
                          </AppBar.Item>
                        </div>
                      </AppBar.Root>
                      <HStack style={{height: '100%', minHeight: 0}}>
                        <Pane
                          id="editor"
                          resizable="right"
                          defaultWidth={window.innerWidth * 0.5}
                          maxWidth={window.innerWidth * 0.8}
                          className={styles.root.editor()}
                        >
                          <Editor
                            height="100%"
                            theme="vs-dark"
                            path="alinea.config.tsx"
                            defaultLanguage="typescript"
                            value={code}
                            beforeMount={editorConfig}
                            onChange={value => {
                              if (value) setCode(value)
                            }}
                            loading={<Loader absolute />}
                          />
                        </Pane>
                        <div style={{flex: '1 0 0'}}>
                          <VStack style={{height: '100%'}}>
                            <ErrorBoundary dependencies={[type]}>
                              <Main>
                                <Main.Container>
                                  {type ? (
                                    <PreviewType type={type} />
                                  ) : (
                                    errors.length === 0 && <Loader absolute />
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
