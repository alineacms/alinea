import {Page, Type, view} from 'alinea/core'
import {Projection} from 'alinea/core/pages/Projection'
import {
  Chip,
  Ellipsis,
  HStack,
  TextLabel,
  Typo,
  VStack,
  fromModule
} from 'alinea/ui'
import {Link} from 'alinea/ui/Link'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {Fragment, ReactNode} from 'react'
import {useDashboard} from '../../hook/UseDashboard.js'
import {useNav} from '../../hook/UseNav.js'
import css from './EntrySummary.module.scss'

const styles = fromModule(css)

export function entrySummaryQuery() {
  return {
    entryId: Page.entryId,
    type: Page.type,
    workspace: Page.workspace,
    root: Page.root,
    title: Page.title,
    parents({parents}) {
      return parents(Page).select({
        entryId: Page.entryId,
        title: Page.title
      })
    }
  } satisfies Projection
}

type SummaryProps = Projection.Infer<ReturnType<typeof entrySummaryQuery>>

export const EntrySummaryRow = view(
  entrySummaryQuery,
  function EntrySummaryRow({
    entryId: id,
    title,
    type: typeName,
    parents
  }: SummaryProps) {
    const nav = useNav()
    const {schema} = useDashboard().config
    const type = schema[typeName]
    if (!type) return null
    return (
      <HStack center full gap={10} className={styles.row()}>
        <VStack>
          {parents.length > 0 && (
            <Ellipsis>
              <Typo.Small>
                <HStack center gap={3}>
                  {parents
                    .map<ReactNode>(({entryId, title}) => (
                      <Fragment key={entryId}>{title}</Fragment>
                    ))
                    .reduce((prev, curr, i) => [
                      prev,
                      <IcRoundKeyboardArrowRight key={`s${i}`} />,
                      curr
                    ])}
                </HStack>
              </Typo.Small>
            </Ellipsis>
          )}
          <Ellipsis>
            <Link href={nav.entry({entryId: id})}>
              <TextLabel label={title} />
            </Link>
          </Ellipsis>
        </VStack>
        <Chip style={{marginLeft: 'auto'}}>
          <TextLabel label={Type.label(type)} />
        </Chip>
      </HStack>
    )
  }
)

export const EntrySummaryThumb = view(
  entrySummaryQuery,
  function EntrySummaryThumb({
    entryId: id,
    title,
    type: typeName,
    parents
  }: SummaryProps) {
    const {schema} = useDashboard().config
    const type = schema[typeName]!
    return (
      <div className={styles.thumb()}>
        {parents.length > 0 && (
          <header className={styles.thumb.header()}>
            <Typo.Small>
              <HStack center gap={3}>
                {parents
                  .map<ReactNode>(({entryId, title}) => (
                    <Fragment key={entryId}>{title}</Fragment>
                  ))
                  .reduce((prev, curr, i) => [
                    prev,
                    <IcRoundKeyboardArrowRight key={`s${i}`} />,
                    curr
                  ])}
              </HStack>
            </Typo.Small>
          </header>
        )}
        <div className={styles.thumb.title()}>
          <TextLabel label={title} />
        </div>
        <div className={styles.thumb.footer()}>
          <Chip style={{marginLeft: 'auto'}}>
            <TextLabel label={Type.label(type)} />
          </Chip>
        </div>
      </div>
    )
  }
)
