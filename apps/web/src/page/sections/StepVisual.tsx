import styler from '@alinea/styler'
import {Label} from '@/layout/Label'
import css from './StepVisual.module.scss'

const styles = styler(css)

export interface StepVisualProps {
  visual: 'editor' | 'commits'
}

function EditorVisual() {
  return (
    <div className={styles.root('editor')} aria-hidden="true">
      <div className={styles.root.field()}>
        <span className={styles.root.label()}>Title</span>
        <div className={styles.root.input()}>Introducing Alinea 2.0</div>
      </div>
      <div className={styles.root.field()}>
        <span className={styles.root.label()}>Body</span>
        <div className={styles.root.input('multiline')}>
          A dashboard your editors will enjoy, with live previews on the real
          site.
        </div>
      </div>
      <div className={styles.root.actions()}>
        <Label variant="neutral" size="small">
          Draft
        </Label>
        <span className={styles.root.publish()}>Publish</span>
      </div>
    </div>
  )
}

const commits = [
  {hash: 'a1f3c9e', message: 'Publish "Introducing 2.0"'},
  {hash: '7be204d', message: 'Update homepage hero'},
  {hash: 'c90d11a', message: 'Add cover field'}
]

function CommitsVisual() {
  return (
    <div className={styles.root('commits')} aria-hidden="true">
      <div className={styles.root.branch()}>
        <span className={styles.root.branch.label()}>main</span>
        <span className={styles.root.branch.status()}>
          <span className={styles.root.branch.dot()} />
          Deployed
        </span>
      </div>
      {commits.map(commit => (
        <div key={commit.hash} className={styles.root.commit()}>
          <span className={styles.root.commit.hash()}>{commit.hash}</span>
          <span className={styles.root.commit.message()}>{commit.message}</span>
        </div>
      ))}
    </div>
  )
}

/** Presentational visuals for the homepage steps */
export function StepVisual({visual}: StepVisualProps) {
  return visual === 'editor' ? <EditorVisual /> : <CommitsVisual />
}
