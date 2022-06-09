import {outcome, TypeConfig} from '@alinea/core'
import {DashboardProvider, SessionProvider, Toolbar} from '@alinea/dashboard'
import {useForm} from '@alinea/editor/hook/UseForm'
import {
  AppBar,
  ErrorBoundary,
  fromModule,
  HStack,
  Pane,
  px,
  Stack,
  TextLabel,
  Typo,
  Viewport,
  VStack
} from '@alinea/ui'
import {IcRoundClose} from '@alinea/ui/icons/IcRoundClose'
import {IcRoundShare} from '@alinea/ui/icons/IcRoundShare'
import {Main} from '@alinea/ui/Main'
import Editor, {Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import esbuild, {BuildFailure, Message, Plugin} from 'esbuild-wasm'
import Head from 'next/head'
import * as React from 'react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {QueryClient, QueryClientProvider} from 'react-query'
import {useClipboard} from 'use-clipboard-copy'
import {createDemo} from './Demo'
import css from './Playground.module.scss'

const styles = fromModule(css)

const defaultValue = `import {
  path,
  text,
  type
} from 'alinea'

export default type('Type', {
  title: text('Title', {width: 0.5}),
  path: path('Path', {width: 0.5})
})`

const init = esbuild.initialize({
  wasmURL: 'https://esm.sh/esbuild-wasm@0.14.43/esbuild.wasm'
})

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
  const [Form, data] = useForm({type, initialValue: state.current}, [type])
  state.current = data
  return (
    <Main>
      <Main.Container>
        <Typo.H1>
          <TextLabel label={type.label} />
        </Typo.H1>

        <Form />
      </Main.Container>
    </Main>
  )
}

// Source: https://stackoverflow.com/a/30106551
function b64EncodeUnicode(str: string) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    })
  )
}
function b64DecodeUnicode(str: string) {
  return decodeURIComponent(
    Array.prototype.map
      .call(atob(str), function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      })
      .join('')
  )
}

const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

export default function Playground() {
  const persistenceId = '@alinea/web/playground'
  const {client, config, session} = useMemo(createDemo, [])
  const [code, storeCode] = useState(() => {
    const [fromUrl] = outcome(() =>
      b64DecodeUnicode(window.location.hash.slice('#code/'.length))
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
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      jsx: 'preserve'
    })
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      `declare module 'alinea'`,
      '@types/alinea/index.d.ts'
    )
  }
  async function compile(code: string) {
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
    window.location.hash = '#code/' + b64EncodeUnicode(code)
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
      <Viewport attachToBody color="#5661E5" contain>
        <DashboardProvider value={{client, config}}>
          <SessionProvider value={session}>
            <QueryClientProvider client={queryClient}>
              <Toolbar.Provider>
                {clipboard.copied && (
                  <div className={styles.root.flash()}>
                    <p className={styles.root.flash.msg()}>
                      URL copied to clipboard
                    </p>
                  </div>
                )}
                <HStack style={{height: '100%'}}>
                  <Pane
                    id="editor"
                    resizable="right"
                    defaultWidth={window.innerWidth * 0.5}
                    maxWidth={window.innerWidth * 0.8}
                  >
                    <Editor
                      height="100%"
                      path="alinea.config.tsx"
                      defaultLanguage="typescript"
                      value={code}
                      beforeMount={editorConfig}
                      onChange={value => {
                        if (value) setCode(value)
                      }}
                    />
                  </Pane>
                  <div style={{flex: '1 0 0'}}>
                    <VStack style={{height: '100%'}}>
                      <HStack>
                        <div style={{paddingLeft: px(18)}}>
                          <Toolbar.Portal />
                        </div>
                        <Stack.Right>
                          <AppBar.Item
                            as="button"
                            icon={IcRoundClose}
                            onClick={handleReset}
                          >
                            Reset
                          </AppBar.Item>
                        </Stack.Right>
                        <AppBar.Item
                          as="button"
                          icon={IcRoundShare}
                          onClick={handleShare}
                        >
                          Share
                        </AppBar.Item>
                      </HStack>
                      <ErrorBoundary dependencies={[type]}>
                        {type && <PreviewType type={type} />}
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
                                        <div>{error.location.lineText}</div>
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
              </Toolbar.Provider>
            </QueryClientProvider>
          </SessionProvider>
        </DashboardProvider>
      </Viewport>
    </>
  )
}
