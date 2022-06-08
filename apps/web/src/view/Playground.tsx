import {TypeConfig} from '@alinea/core'
import {createId} from '@alinea/core/Id'
import {useForm} from '@alinea/editor/hook/UseForm'
import {
  ErrorBoundary,
  HStack,
  Pane,
  px,
  TextLabel,
  Typo,
  Viewport,
  VStack
} from '@alinea/ui'
import {Main} from '@alinea/ui/Main'
import Editor, {Monaco} from '@monaco-editor/react'
import * as alinea from 'alinea'
import esbuild, {BuildFailure, Message, Plugin} from 'esbuild-wasm'
import Head from 'next/head'
import {useMemo, useRef, useState} from 'react'

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

export default function Playground() {
  const [errors, setErrors] = useState<Array<Message>>([])
  const [config, setConfig] = useState<TypeConfig | undefined>()
  const api = useMemo(() => {
    let script: HTMLScriptElement | undefined
    function handleBuildErrors(failure: BuildFailure) {
      setErrors(failure.errors)
    }
    const api = {
      config(monaco: Monaco) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: 'preserve'
        })
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          `declare module 'alinea'`,
          '@types/alinea/index.d.ts'
        )
      },
      async compile(value: string | undefined) {
        if (!value) return
        const revision = 'cb_' + createId()
        const global = window as any
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
    }
    init.then(() => api.compile(defaultValue))
    return api
  }, [])
  return (
    <>
      <Head>
        <style>{`#__next {height: 100%}`}</style>
      </Head>
      <Viewport attachToBody color="#5661E5" contain>
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
              defaultValue={defaultValue}
              beforeMount={api.config}
              onChange={api.compile}
            />
          </Pane>
          <div style={{flex: '1 0 auto'}}>
            <VStack style={{height: '100%'}}>
              <ErrorBoundary dependencies={[config]}>
                {config && <PreviewType type={config} />}
              </ErrorBoundary>
              {errors.length > 0 && (
                <div
                  style={{
                    maxHeight: px(300),
                    padding: px(30),
                    overflow: 'auto',
                    flexShrink: 0,
                    marginTop: 'auto',
                    background: 'white',
                    borderTop: '1px solid #dddde9',
                    lineHeight: 1.6
                  }}
                >
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
