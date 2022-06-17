import {Client} from '@alinea/client'
import {config} from '@alinea/content'
import dynamic from 'next/dynamic'

const client = new Client(config, '/api/cms')

const dashboard = () =>
  import('@alinea/dashboard').then(({Dashboard}) => Dashboard)
const Dashboard = dynamic(dashboard, {ssr: false})

export default function Admin() {
  return (
    <>
      <style>{`#__next {height: 100%}`}</style>
      <Dashboard config={config} client={client} />
    </>
  )
}
