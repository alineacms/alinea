'use client'

import styler from '@alinea/styler'
import {
  Component,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState
} from 'react'
import type {FieldPreviewKey} from './fieldCatalog'
import css from './FieldPreview.module.scss'

const styles = styler(css)

const loadRuntime = () => import('./FieldPreviewRuntime')
const FieldPreviewRuntime = lazy(loadRuntime)

// Previews are thumbnails: keep them out of the tab order and the
// accessibility tree, the card around them is the link
const inert = {inert: true} as object

export interface FieldPreviewProps {
  field: FieldPreviewKey
  label: string
}

/**
 * The dashboard input of a field. The field editors load once the first card
 * comes near the viewport, until then a placeholder of the same shape shows.
 */
export function FieldPreview({field, label}: FieldPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return
        setVisible(true)
        observer.disconnect()
      },
      {rootMargin: '400px 0px'}
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const placeholder = <FieldPlaceholder label={label} />
  return (
    <div ref={ref} className={styles.root()} {...inert}>
      {visible ? (
        <PreviewBoundary fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <div className={styles.root.loaded()}>
              <FieldPreviewRuntime field={field} />
            </div>
          </Suspense>
        </PreviewBoundary>
      ) : (
        placeholder
      )}
    </div>
  )
}

interface FieldPlaceholderProps {
  label: string
}

function FieldPlaceholder({label}: FieldPlaceholderProps) {
  return (
    <div className={styles.placeholder()} aria-hidden="true">
      <span className={styles.placeholder.label()}>{label}</span>
      <span className={styles.placeholder.input()} />
    </div>
  )
}

interface PreviewBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

interface PreviewBoundaryState {
  failed: boolean
}

// A preview that fails to render keeps its placeholder, the page stays up
class PreviewBoundary extends Component<
  PreviewBoundaryProps,
  PreviewBoundaryState
> {
  state: PreviewBoundaryState = {failed: false}
  static getDerivedStateFromError(): PreviewBoundaryState {
    return {failed: true}
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
