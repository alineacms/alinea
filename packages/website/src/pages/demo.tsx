import {Button, HStack, Loader, Typo, Viewport} from '@alinea/ui'
import {Modal} from '@alinea/ui/Modal'
import dynamic from 'next/dynamic'
import {Suspense, useState} from 'react'

const DemoPage = dynamic(() => import('../view/Demo'), {
  ssr: false,
  suspense: true
})

export default function Demo() {
  const [reminderOpen, setReminderOpen] = useState(true)
  return (
    <Viewport color="red">
      <Modal open={reminderOpen} onClose={() => setReminderOpen(false)}>
        <Typo.H1>Demo</Typo.H1>
        <Typo.P>
          This is a local demo showcasing{' '}
          <Typo.Link href="/">Alinea CMS</Typo.Link>
        </Typo.P>
        <HStack>
          <Button size="large" onClick={() => setReminderOpen(false)}>
            Let's see it
          </Button>
        </HStack>
      </Modal>
      <Suspense fallback={<Loader absolute />}>
        <DemoPage />
      </Suspense>
    </Viewport>
  )
}
