import styler from '@alinea/styler'
import {diagrams} from './diagrams'
import css from './PublishingDiagram.module.scss'

const styles = styler(css)

interface ArrowHeadProps {
  id: string
  variant?: 'accent' | 'faint'
}

function ArrowHead({id, variant}: ArrowHeadProps) {
  return (
    <marker
      id={id}
      viewBox="0 0 8 8"
      refX="7"
      refY="4"
      markerWidth="6"
      markerHeight="6"
      orient="auto"
    >
      <path
        className={styles.PublishingDiagram.head(variant)}
        d="M0.5 0.5 L7 4 L0.5 7.5"
      />
    </marker>
  )
}

export function PublishingDiagram() {
  return (
    <figure className={styles.PublishingDiagram()}>
      <div className={styles.PublishingDiagram.scroll()}>
        <svg
          className={styles.PublishingDiagram.svg()}
          viewBox="0 0 680 292"
          role="img"
          aria-label={diagrams.publishing.description}
        >
          <defs>
            <ArrowHead id="publishing-diagram-arrow" />
            <ArrowHead id="publishing-diagram-arrow-accent" variant="accent" />
            <ArrowHead id="publishing-diagram-arrow-faint" variant="faint" />
          </defs>
          <path
            className={styles.PublishingDiagram.line()}
            d="M151 66 H209"
            markerEnd="url(#publishing-diagram-arrow)"
          />
          <path
            className={styles.PublishingDiagram.line()}
            d="M385 66 H443"
            markerEnd="url(#publishing-diagram-arrow)"
          />
          <path
            className={styles.PublishingDiagram.line('accent')}
            d="M299 109 V191"
            markerEnd="url(#publishing-diagram-arrow-accent)"
          />
          <path
            className={styles.PublishingDiagram.line('faint')}
            d="M564 109 V191"
            markerEnd="url(#publishing-diagram-arrow-faint)"
          />
          <rect
            className={styles.PublishingDiagram.box()}
            x="0.5"
            y="24.5"
            width="150"
            height="84"
            rx="10"
          />
          <rect
            className={styles.PublishingDiagram.box()}
            x="214.5"
            y="24.5"
            width="170"
            height="84"
            rx="10"
          />
          <rect
            className={styles.PublishingDiagram.box()}
            x="448.5"
            y="24.5"
            width="231"
            height="84"
            rx="10"
          />
          <rect
            className={styles.PublishingDiagram.box('accent')}
            x="214.5"
            y="196.5"
            width="170"
            height="94"
            rx="10"
          />
          <rect
            className={styles.PublishingDiagram.box('muted')}
            x="448"
            y="196"
            width="232"
            height="95"
            rx="10"
          />
          <text className={styles.PublishingDiagram.title()} x="20" y="62">
            Dashboard
          </text>
          <text className={styles.PublishingDiagram.title()} x="234" y="62">
            Your site's handler
          </text>
          <text className={styles.PublishingDiagram.title()} x="468" y="62">
            Git repository
          </text>
          <text className={styles.PublishingDiagram.title()} x="234" y="232">
            Your running site
          </text>
          <text
            className={styles.PublishingDiagram.title('muted')}
            x="468"
            y="232"
          >
            CI build
          </text>
          <text className={styles.PublishingDiagram.detail()} x="20" y="86">
            Editor clicks Publish
          </text>
          <text
            className={styles.PublishingDiagram.detail('code')}
            x="234"
            y="86"
          >
            /api/cms
          </text>
          <text
            className={styles.PublishingDiagram.detail('code')}
            x="468"
            y="86"
          >
            content/**/*.json
          </text>
          <text className={styles.PublishingDiagram.detail()} x="234" y="256">
            Serves the new content
          </text>
          <text
            className={styles.PublishingDiagram.detail('muted')}
            x="468"
            y="256"
          >
            Skipped when a commit only
          </text>
          <text
            className={styles.PublishingDiagram.detail('muted')}
            x="468"
            y="274"
          >
            touches content
          </text>
          <text
            className={styles.PublishingDiagram.label()}
            x="180"
            y="56"
            textAnchor="middle"
          >
            publish
          </text>
          <text
            className={styles.PublishingDiagram.label()}
            x="414"
            y="56"
            textAnchor="middle"
          >
            commit
          </text>
          <text
            className={styles.PublishingDiagram.label('accent')}
            x="310"
            y="155"
          >
            revalidate
          </text>
          <text className={styles.PublishingDiagram.label()} x="575" y="155">
            push
          </text>
          <circle
            className={styles.PublishingDiagram.live()}
            cx="366"
            cy="227"
            r="3"
          />
        </svg>
      </div>
      <figcaption className={styles.PublishingDiagram.steps()}>
        <span className={styles.PublishingDiagram.step()}>
          <span className={styles.PublishingDiagram.step.number()}>1</span>
          Publishing writes a commit to your repository through your own
          handler.
        </span>
        <span className={styles.PublishingDiagram.step()}>
          <span className={styles.PublishingDiagram.step.number()}>2</span>
          The handler marks your pages stale, and they rebuild in the background
          with the new content.
        </span>
        <span className={styles.PublishingDiagram.step()}>
          <span className={styles.PublishingDiagram.step.number()}>3</span>
          An{' '}
          <code className={styles.PublishingDiagram.step.code()}>
            ignoreCommand
          </code>{' '}
          skips the CI build when only content changed.
        </span>
      </figcaption>
    </figure>
  )
}
