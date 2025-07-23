import {useTranslation} from 'alinea/dashboard/hook/UseTranslation'
import {px, Typo, VStack} from 'alinea/ui'

export function Welcome() {
  const {welcome: t} = useTranslation()
  return (
    <VStack gap={20} style={{marginTop: px(20), padding: px(6)}}>
      <p>{t.title}</p>
      <Typo.Link
        href="https://alineacms.com/docs/configuration/intro"
        target="_blank"
      >
        {t.button}
      </Typo.Link>
    </VStack>
  )
}
