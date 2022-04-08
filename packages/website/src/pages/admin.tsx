import {PasswordLessLogin} from '@alineacms/auth.passwordless/PasswordLessLogin'
import {Client} from '@alineacms/client'
import dynamic from 'next/dynamic'
import {config} from '../../.alinea'

const client = new Client(config, '/api/cms')

const dashboard = () =>
  import('@alineacms/dashboard').then(({Dashboard}) => Dashboard)
const Dashboard = dynamic(dashboard, {ssr: false})

export default function Admin() {
  return <Dashboard config={config} client={client} auth={PasswordLessLogin} />
}
