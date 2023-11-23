import dynamic from 'next/dynamic'

const DemoPage = dynamic(() => import('../demo/Demo'), {
  ssr: false
})

export default function Demo() {
  return <DemoPage />
}
