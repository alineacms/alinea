import {px, Typo, VStack} from 'alinea/ui'

export function Welcome() {
  return (
    <VStack gap={20} style={{marginTop: px(20), padding: px(6)}}>
      <p>Your alinea installation is now ready for configuration.</p>
      <Typo.Link
        href="https://alinea.sh/docs/configuration/intro"
        target="_blank"
      >
        Learn how to configure
      </Typo.Link>
    </VStack>
  )
}
