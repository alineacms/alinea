'use client'

import {Breadcrumbs} from '@/layout/Breadcrumbs'
import {HStack, VStack, fromModule} from 'alinea/ui'
import {IcRoundSearch} from 'alinea/ui/icons/IcRoundSearch'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {
  Fragment,
  HTMLAttributes,
  PropsWithChildren,
  Suspense,
  memo,
  use,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import {createPortal} from 'react-dom'
import css from './Header.module.scss'

const styles = fromModule(css)

export function HeaderRoot({children}: PropsWithChildren) {
  const pathname = usePathname()
  return (
    <header className={styles.root({transparent: pathname === '/'})}>
      {children}
    </header>
  )
}

export function MobileMenu({
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  const pathname = usePathname()
  useEffect(() => {
    const checkbox = document.getElementById('mobilemenu')! as HTMLInputElement
    checkbox.checked = false
  }, [pathname])
  return <div {...props}>{children}</div>
}

const resultsCache = new Map<string, any>()
function searchResults(searchTerm: string): Promise<Array<SearchResult>> {
  if (resultsCache.has(searchTerm)) return resultsCache.get(searchTerm)
  const res = fetch(`/api/search?query=${searchTerm}`)
    .then(res => res.json())
    .catch(() => [])
  resultsCache.set(searchTerm, res)
  return res
}

interface SnippetProps {
  snippet: string
}

const Snippet = memo(function Snippet({snippet}: SnippetProps) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(snippet, 'text/html')
  const nodes = [...doc.body.childNodes]
  return (
    <p>
      {nodes.map((node, i) => {
        if (node.nodeName === 'MARK')
          return <strong key={i}>{node.textContent}</strong>
        return <Fragment key={i}>{node.textContent}</Fragment>
      })}
    </p>
  )
})

interface SearchResult {
  title: string
  url: string
  snippet: string
  parents: Array<{
    id: string
    title: string
    url: string
  }>
}

interface SearchResultsProps {
  searchTerm: string
}

const SearchResults = memo(function SearchResults({
  searchTerm
}: SearchResultsProps) {
  const results = use(searchResults(searchTerm))
  const ref = useRef<HTMLUListElement>(null)
  useLayoutEffect(() => {
    const list = ref.current
    if (list) list.scrollTop = 0
  }, [searchTerm])
  if (results.length === 0)
    return <p className={styles.results()}>No results</p>
  return (
    <ul ref={ref} className={styles.results()}>
      {results.map((result: SearchResult) => {
        return (
          <li key={result.url} className={styles.results.row()}>
            <Link href={result.url}>
              <VStack gap={6}>
                <header>
                  {result.parents && (
                    <Breadcrumbs flat parents={result.parents} />
                  )}
                  <h3>{result.title}</h3>
                </header>
                <Snippet snippet={result.snippet} />
              </VStack>
            </Link>
          </li>
        )
      })}
    </ul>
  )
})

interface SearchModalProps {
  onClose: () => void
}

function SearchModal({onClose}: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const searching = useDeferredValue(searchTerm)
  const isPending = searchTerm && searchTerm !== searching
  // Close on esc
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [])
  return createPortal(
    <div className={styles.searchmodal()}>
      <div className={styles.searchmodal.backdrop()} onClick={onClose} />
      <div className={styles.searchmodal.container()}>
        <HStack
          as="label"
          className={styles.searchmodal.header()}
          center
          gap={8}
        >
          <IcRoundSearch
            className={styles.searchmodal.header.icon({
              pending: isPending
            })}
          />
          <input
            autoFocus
            placeholder="Search"
            className={styles.searchmodal.header.input()}
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value)
            }}
          />
        </HStack>
        {searchTerm && (
          <Suspense fallback={<p className={styles.results()}>Loading</p>}>
            <SearchResults searchTerm={searching} />
          </Suspense>
        )}
      </div>
    </div>,
    document.body
  )
}

export function SearchButton({children}: PropsWithChildren) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])
  return (
    <>
      <div
        onClick={e => {
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
      >
        {children}
      </div>
      {isOpen && <SearchModal onClose={() => setIsOpen(false)} />}
    </>
  )
}
