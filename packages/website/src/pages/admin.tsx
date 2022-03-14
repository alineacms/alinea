import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Client} from '@alinea/client'
import {Dashboard} from '@alinea/dashboard'
import {config} from '../../.alinea/config'

const client = new Client(config, '/api/cms')

export default function Admin() {
  return (
    <div suppressHydrationWarning>
      {process.browser && (
        <Dashboard config={config} client={client} auth={PasswordLessLogin} />
      )}
    </div>
  )
}
