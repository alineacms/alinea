import {Button, HStack, Loader, Typo, Viewport} from '@alineacms/ui'
import {Modal} from '@alineacms/ui/Modal'
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
          This is a demo showcasing the{' '}
          <Typo.Link href="/">Alinea CMS</Typo.Link> dashboard. It is not
          connected to a server, any changes you make are persisted locally.
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
