import {Docs} from '@alinea/content/web'
import {Label} from '@alinea/core'
import {TextLabel} from '@alinea/ui'
import Link from 'next/link'
import {Layout} from './layout/Layout'

type DocsPageProps = Docs & {
  children: Array<{url: string; title: Label}>
}

export function DocsPage({children, title}: DocsPageProps) {
  return (
    <Layout.Container>
      <h1>{title}</h1>
      <div>
        {children?.map(child => {
          return (
            <Link key={child.url} href={child.url}>
              <a>
                <TextLabel label={child.title} />
              </a>
            </Link>
          )
        })}
      </div>
    </Layout.Container>
  )
}
