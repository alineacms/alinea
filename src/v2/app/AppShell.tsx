import styler from '@alinea/styler'
import css from './AppShell.module.css'
import {SidebarTree} from './SidebarTree'

const styles = styler(css)

export function AppShell() {
  return (
    <div className={styles.root()}>
      <aside className={styles.left()}>
        <div className={styles.leftSectionHeader()}>
          <p className={styles.meta()}>Placeholder: workspace switcher</p>
        </div>

        <div className={styles.treeWrap()}>
          <SidebarTree />
        </div>

        <footer className={styles.leftFooter()}>
          <div className={styles.meta()}>
            Placeholder: sidebar footer status
          </div>
        </footer>
      </aside>

      <main className={styles.main()}>
        <header className={styles.mainHeader()}>
          <h1 className={styles.mainTitle()}>Main area</h1>
        </header>

        <div className={styles.mainBody()}>
          <div className={styles.form()}>
            <p className={styles.meta()}>Placeholder: selected entry summary</p>
            <p className={styles.meta()}>Placeholder: field editor surface</p>
          </div>
        </div>
      </main>
    </div>
  )
}
