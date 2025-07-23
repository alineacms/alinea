import {useTranslation} from 'alinea/dashboard/hook/useTranslation'
import {px, Typo, VStack} from 'alinea/ui'

export const copy = {
  title: 'Your alinea installation is now ready for configuration.',
  button: 'Learn how to configure'
}

export function Welcome() {
  const t = useTranslation(copy)
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
