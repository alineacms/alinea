import {TypeConfig} from '@alinea/core'
import {createId} from '@alinea/core/Id'
import {useForm} from '@alinea/editor/hook/UseForm'
import {InputState} from '@alinea/editor/InputState'
import {HStack, Pane, Viewport} from '@alinea/ui'
import Editor, {Monaco} from '@monaco-editor/react'
import esbuild from 'esbuild-wasm'
import Head from 'next/head'
import Script from 'next/script'
import {useMemo, useState} from 'react'

const defaultValue = `import {
  path,
  text,
  type
} from 'alinea'

export default type('Type', {
  title: text('Title')
})`

const init = esbuild.initialize({
  wasmURL: 'https://esm.sh/esbuild-wasm@0.14.43/esbuild.wasm'
})

type PreviewTypeProps = {
  type: TypeConfig
}

function PreviewType({type}: PreviewTypeProps) {
  console.log(type)
  const [Form] = useForm({type})
  return <Form />
}

export default function Playground() {
  const form = useState({})
  const state = new InputState.StatePair(form[0], form[1])
  const [config, setConfig] = useState<TypeConfig | undefined>()
  const api = useMemo(() => {
    let script: HTMLScriptElement | undefined
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
        const result = await esbuild.transform(value, {
          loader: 'tsx'
        })
        const src = URL.createObjectURL(
          new Blob([result.code], {type: 'application/javascript'})
        )
        if (script) document.head.removeChild(script)
        global[revision] = function (type: TypeConfig) {
          setConfig(type)
        }
        script = document.createElement('script')
        script.type = 'module'
        script.innerHTML = `import type from '${src}';${revision}(type)`
        document.head.appendChild(script)
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
      <Script type="importmap">
        {`{
          "imports": {
            "alinea": "https://esm.sh/alinea"
          }
        }`}
      </Script>
      <Viewport attachToBody color="#5661E5" contain>
        <HStack style={{height: '100%'}}>
          <Pane id="editor" resizable="right">
            <Editor
              height="100%"
              path="alinea.config.tsx"
              defaultLanguage="typescript"
              defaultValue={defaultValue}
              beforeMount={api.config}
              onChange={api.compile}
            />
          </Pane>
          <div style={{width: '50%', flexShrink: 0}}>
            {config && <PreviewType type={config} />}
          </div>
        </HStack>
      </Viewport>
    </>
  )
}
