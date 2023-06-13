import {config} from '@alinea/generated/config'
import {createStore} from '@alinea/generated/store'
import {JWTPreviews, Server} from 'alinea/backend'
import {IndexedDBData, IndexedDBDrafts} from 'alinea/backend/indexeddb'
import {Dashboard, Preview} from 'alinea/dashboard'
import {DraftsStatus, useDrafts} from 'alinea/dashboard/hook/UseDrafts'
import {Loader, useObservable} from 'alinea/ui'
import {useQuery} from 'alinea/vendor/react-query'
import Head from 'next/head'
import {ComponentType, useEffect, useMemo, useState} from 'react'
import Frame, {useFrame} from 'react-frame-component'
import DemoHome, {queryHome} from '../pages/home'
import Recipe, {queryRecipe} from '../pages/recipes/[slug]'

export interface DemoProps {
  fullPage?: boolean
}

export default function Demo({fullPage}: DemoProps) {
  const {client, config} = useMemo(createDemo, [])
  const preview = useMemo(() => createPreview(client, config), [])
  config.options.workspaces.demo.options.preview = preview
  return (
    <>
      <Head>
        <title>Alinea demo</title>
      </Head>
      <Dashboard fullPage={fullPage} config={config} client={client} />
    </>
  )
}

interface DemoPreviewProps {
  entry: Entry
  previewToken: string
}

interface PreviewData {
  query: (pages: any) => any
  view: ComponentType<any>
}

function preview(entry: Entry): PreviewData {
  switch (entry.type) {
    case 'Home':
    case 'Recipes':
      return {query: queryHome, view: DemoHome}
    case 'Recipe':
      return {
        query: pages => queryRecipe(pages, entry.path),
        view: Recipe
      }
    default:
      throw new Error(`Unknown type: ${entry.type}`)
  }
}

interface SynchronizeHeadProps {
  active: boolean
  children: JSX.Element
}

// Source: https://github.com/tajo/ladle/blob/34bf38692683caf2469c7d5524a0c97771dc716e/packages/ladle/lib/app/src/story.tsx#L54
function SynchronizeHead({active, children}: SynchronizeHeadProps) {
  const {window: storyWindow} = useFrame()
  const syncHead = () => {
    if (!storyWindow) return
    ;[...(document.head.children as any)].forEach(child => {
      if (
        child.tagName === 'STYLE' ||
        (child.tagName === 'LINK' &&
          (child.getAttribute('type') === 'text/css' ||
            child.getAttribute('rel') === 'stylesheet'))
      ) {
        storyWindow.document.head.appendChild(
          child.cloneNode(true)
        ) as HTMLStyleElement
      }
    })
  }
  useEffect(() => {
    if (active) {
      syncHead()
      const observer = new MutationObserver(() => syncHead())
      document.documentElement.setAttribute('data-iframed', '')
      observer.observe(document.head, {
        subtree: true,
        characterData: true,
        childList: true
      })
      return () => {
        observer && observer.disconnect()
      }
    }
    return
  }, [active])
  return children
}

function createPreview(client: Server, config: Config) {
  return function DemoPreview({entry, previewToken}: DemoPreviewProps) {
    const {query, view: View} = preview(entry)
    const drafts = useDrafts()
    const status = useObservable(drafts.status)
    const [iteration, setIteration] = useState(0)
    useEffect(() => {
      if (status === DraftsStatus.Synced) setIteration(x => x + 1)
    }, [status])
    const {data: props} = useQuery(
      ['preview', entry.id, iteration],
      () => {
        const pages = client.loadPages('demo', {preview: true})
        return query(pages)
      },
      {keepPreviousData: true, cacheTime: 0}
    )
    return (
      <Preview>
        {props ? (
          <Frame
            style={{
              position: 'absolute',
              border: 'none',
              height: '100%',
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <SynchronizeHead active>
              <View {...props!} />
            </SynchronizeHead>
          </Frame>
        ) : (
          <Loader absolute />
        )}
      </Preview>
    )
  }
}

function createLocalClient() {
  const data = new IndexedDBData()
  return new Server({
    config,
    createStore,
    drafts: new IndexedDBDrafts(),
    target: data,
    media: data,
    previews: new JWTPreviews('demo')
  })
}

function createDemo() {
  const client = createLocalClient()
  return {
    config,
    client,
    session: {
      user: {sub: 'anonymous'},
      cnx: client,
      end: async () => {}
    }
  }
}
