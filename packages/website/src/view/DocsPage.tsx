import {Label} from '@alineacms/core'
import {TextLabel} from '@alineacms/ui'
import Link from 'next/link'
import {Docs} from '../../.alinea/web'
import {Container} from './layout/Container'

type DocsPageProps = Docs & {
  children: Array<{url: string; title: Label}>
}

export function DocsPage({children, title}: DocsPageProps) {
  return (
    <Container>
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
    </Container>
  )
}
