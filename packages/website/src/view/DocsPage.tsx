import {Docs} from '.alinea'
import {Label} from '@alinea/core'
import {TextLabel} from '@alinea/ui'
import Link from 'next/link'
import {Container} from './layout/Container'

type DocsPageProps = Docs & {
  children: Array<{$path: string; title: Label}>
}

export function DocsPage({children}: DocsPageProps) {
  return (
    <Container>
      Docs 123
      <div>
        {children?.map(child => {
          return (
            <Link key={child.$path} href={child.$path}>
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
