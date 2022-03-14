import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Dashboard} from '@alinea/dashboard'
import {config} from '../../.alinea/config'

export default function Admin() {
  return (
    <div suppressHydrationWarning>
      {process.browser && (
        <Dashboard config={config} apiUrl="/api/cms" auth={PasswordLessLogin} />
      )}
    </div>
  )
}
