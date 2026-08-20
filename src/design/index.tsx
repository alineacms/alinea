import styler from '@alinea/styler'
import {
  CSSProperties,
  MouseEvent,
  PropsWithChildren,
  ReactNode,
  useId,
  useState
} from 'react'
import {flushSync} from 'react-dom'
import {createRoot} from 'react-dom/client'
import {All} from '../components/Button.stories.js'
import shell from '../dashboard/app/AppShell.module.css'
import rail from '../dashboard/app/ui/Rail.module.css'
import '../dashboard/global.css'
import viewport from './viewport.module.css'

const styles = styler(viewport)

interface ViewportProps extends PropsWithChildren {
  label?: ReactNode
  width?: number
}

function Viewport({label, width, children}: ViewportProps) {
  const [isActive, setIsActive] = useState(false)
  const uniqueId = useId().replace(/:/g, '')

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    event.currentTarget.focus()
    document.startViewTransition(() => {
      flushSync(() => {
        setIsActive(prev => !prev)
      })
    })
  }
  return (
    <div className={viewport.viewport}>
      {label && <div className={viewport.label}>{label}</div>}
      <div className={viewport.canvas}>
        <div
          className={styles.frame({active: isActive})}
          style={
            {
              '--content-width': width ? `${width}px` : undefined,
              '--alinea-viewport-transition-name': `viewport-${uniqueId}`
            } as CSSProperties
          }
          tabIndex={-1}
          onClick={handleClick}
        >
          <div className={viewport.inner}>
            <div className={viewport.layout}>{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <>
      <Viewport label="Button" width={320}>
        <All />
      </Viewport>

      <Viewport label="Desktop">
        <div className={shell.AppShell}>
          <div className={shell.AppShellInner}>
            <div className={shell.AppShellContent}>
              <main className={`${rail.Rail} ${rail['is-main']}`}>
                <header className={rail.RailHeader}>Header</header>
                <div className={rail.RailBody}>
                  <div className={rail.RailContent}>Content</div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </Viewport>

      <Viewport label="Long content">
        <div className={shell.AppShell}>
          <div className={shell.AppShellInner}>
            <div className={shell.AppShellContent}>
              <main className={`${rail.Rail} ${rail['is-main']}`}>
                <header className={rail.RailHeader}>Header</header>
                <div className={rail.RailBody}>
                  <div className={rail.RailContent}>
                    {Array.from({length: 24}, (_, index) => (
                      <p key={index}>
                        Section {index + 1}: This is a deliberately long block
                        of content for testing how the preview handles pages
                        that are taller than the available viewport.
                      </p>
                    ))}
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </Viewport>

      <Viewport label="Desktop">
        <div className={shell.AppShell}>
          <div className={shell.AppShellInner}>
            <div className={shell.AppShellContent}>
              <main className={`${rail.Rail} ${rail['is-main']}`}>
                <header className={rail.RailHeader}>Header</header>
                <div className={rail.RailBody}>
                  <div className={rail.RailContent}>Content</div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </Viewport>

      <Viewport label="Desktop">
        <div className={shell.AppShell}>
          <div className={shell.AppShellInner}>
            <div className={shell.AppShellContent}>
              <main className={`${rail.Rail} ${rail['is-main']}`}>
                <header className={rail.RailHeader}>Header</header>
                <div className={rail.RailBody}>
                  <div className={rail.RailContent}>Content</div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </Viewport>
    </>
  )
}

const root = createRoot(document.documentElement)
root.render(<App />)
