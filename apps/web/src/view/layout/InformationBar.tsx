import {VStack} from 'alinea/ui'
import {Newsletter} from './engage/Newsletter.js'

export function InformationBar() {
  return (
    <VStack gap={30}>
      <Newsletter />
    </VStack>
  )
}
