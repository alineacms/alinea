import {outcome, TypeConfig} from '@alinea/core'
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
import {useEffect, useRef, useState} from 'react'
import {useClipboard} from 'use-clipboard-copy'
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

export default function Playground() {
  const [code, setCode] = useState(() => {
    const [code] = outcome(() =>
      b64DecodeUnicode(window.location.hash.slice('#code/'.length))
    )
    return code || defaultValue
  })
  const [errors, setErrors] = useState<Array<Message>>([])
  const [config, setConfig] = useState<TypeConfig | undefined>()
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
  async function compile(value: string | undefined) {
    if (!value) return
    setCode(value)
    const result = await esbuild
      .build({
        platform: 'browser',
        bundle: true,
        write: false,
        format: 'cjs',
        stdin: {
          contents: value,
          sourcefile: 'alinea.config.tsx',
          loader: 'ts'
        },
        plugins: [alineaPlugin]
      })
      .catch(handleBuildErrors)
    if (!result) return
    try {
      setErrors([])
      setConfig(eval(result.outputFiles[0].text).default)
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
  }, [])
  return (
    <>
      <Head>
        <style>{`#__next {height: 100%}`}</style>
      </Head>
      <Viewport attachToBody color="#5661E5" contain>
        {clipboard.copied && (
          <div className={styles.root.flash()}>
            <p className={styles.root.flash.msg()}>URL copied to clipboard</p>
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
              onChange={compile}
            />
          </Pane>
          <div style={{flex: '1 0 auto'}}>
            <VStack style={{height: '100%'}}>
              <AppBar.Root>
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
              </AppBar.Root>
              <ErrorBoundary dependencies={[config]}>
                {config && <PreviewType type={config} />}
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
                                  [{error.location.file}: {error.location.line}]
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
      </Viewport>
    </>
  )
}
