import type {GlobalProvider} from '@ladle/react'
import {
  Component,
  type CSSProperties,
  type ErrorInfo,
  type PropsWithChildren,
  type ReactNode
} from 'react'
import '../src/dashboard/global.css'

interface StoryErrorBoundaryProps extends PropsWithChildren {
  resetKey: string
}

interface StoryErrorBoundaryState {
  error?: Error
}

class StoryErrorBoundary extends Component<
  StoryErrorBoundaryProps,
  StoryErrorBoundaryState
> {
  state: StoryErrorBoundaryState = {}

  static getDerivedStateFromError(error: Error): StoryErrorBoundaryState {
    return {error}
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Story failed to render', error, info.componentStack)
  }

  componentDidUpdate(previousProps: StoryErrorBoundaryProps): void {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.error !== undefined
    ) {
      this.setState({error: undefined})
    }
  }

  render(): ReactNode {
    const {error} = this.state
    if (error) return <StoryError error={error} />
    return this.props.children
  }
}

interface StoryErrorProps {
  error: Error
}

function StoryError({error}: StoryErrorProps) {
  return (
    <main style={styles.StoryError}>
      <section style={styles.StoryErrorPanel}>
        <h1 style={styles.StoryErrorTitle}>Story failed to render</h1>
        <p style={styles.StoryErrorMessage}>{error.message}</p>
        {error.stack && <pre style={styles.StoryErrorStack}>{error.stack}</pre>}
      </section>
    </main>
  )
}

export const Provider: GlobalProvider = ({children, globalState}) => {
  return (
    <StoryErrorBoundary resetKey={globalState.story}>
      {children}
    </StoryErrorBoundary>
  )
}

const styles = {
  StoryError: {
    boxSizing: 'border-box',
    display: 'flex',
    minHeight: '100vh',
    padding: 24,
    color: 'var(--alinea-fg)'
  },
  StoryErrorPanel: {
    alignSelf: 'flex-start',
    width: 'min(900px, 100%)',
    padding: 16,
    border: '1px solid var(--alinea-border)',
    borderRadius: 6,
    background: 'var(--alinea-bg)'
  },
  StoryErrorTitle: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 600
  },
  StoryErrorMessage: {
    margin: 0,
    color: 'var(--alinea-danger-subtle-fg)'
  },
  StoryErrorStack: {
    maxHeight: 360,
    overflow: 'auto',
    margin: '16px 0 0',
    padding: 12,
    borderRadius: 6,
    background: 'var(--alinea-bg-muted)',
    fontSize: 12,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap'
  }
} satisfies Record<string, CSSProperties>
