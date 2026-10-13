import styler from '@alinea/styler'
import type {Metadata} from 'next'
import {Label} from '@/layout/Label'
import {getMetadata} from '@/utils/metadata'
import css from './LabPage.module.scss'
import {LabDynamic} from './lab/Lab.dynamic'

const styles = styler(css)

const description =
  "Watch content move between editors' browsers, serverless instances, caches and git, run by Alinea's own code in your browser."

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await getMetadata({
    url: '/lab',
    title: 'Sync lab',
    description
  })
  // Not listed until it is announced
  return {...metadata, robots: {index: false, follow: false}}
}

export default function LabPage() {
  return (
    <main className={styles.LabPage()}>
      <header className={styles.LabPage.header()}>
        <Label>Lab</Label>
        <h1 className={styles.LabPage.title()}>How content syncs</h1>
        <p className={styles.LabPage.intro()}>
          Content lives in git, and in a copy of a database everywhere it is
          read: in the browser of every editor, and in every instance of your
          site. Below, Alinea's own code runs in your browser: the route handler
          and the CMS of server renders in workers standing in for serverless
          instances, and the dashboard's shared worker for each user, with its
          store in IndexedDB. Run a scenario, or edit, visit, push and deploy
          yourself.
        </p>
      </header>
      <div className={styles.LabPage.app()}>
        <LabDynamic />
      </div>
      <section className={styles.LabPage.notes()}>
        <h2 className={styles.LabPage.notes.title()}>What is real here</h2>
        <ul className={styles.LabPage.notes.list()}>
          <li>
            Isolates run <code>createHandlerWithDatabase</code> and{' '}
            <code>NextCMS</code> as <code>alinea/next</code> sets them up, each
            on its own copy of the generated database.
          </li>
          <li>
            Every user runs the dashboard's shared worker:{' '}
            <code>DashboardWorker</code> on a <code>BrowserEntryStore</code>,
            which keeps its bases in IndexedDB. Tabs reach it as the dashboard
            does.
          </li>
          <li>
            The backend database is reached through <code>DatabaseApi</code>,
            the cloud through <code>CloudRemote</code>, and renders share the
            content sha through <code>syncIfStale</code>.
          </li>
          <li>
            Simulated are the hosts around them: the network between nodes, git,
            the cloud's API, the Next.js data cache and a clock you can move
            ahead.
          </li>
        </ul>
      </section>
    </main>
  )
}
