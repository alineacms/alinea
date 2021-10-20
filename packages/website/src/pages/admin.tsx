import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {EntryOf} from '@alinea/core'
import Dashboard from '@alinea/dashboard'
import {schema} from '../schema'
import {Preview} from '../view/Preview'

/*const Dashboard: typeof import('@alinea/dashboard')['default'] = dynamic(
  () => import('@alinea/dashboard'),
  {
    ssr: false
  }
) as any*/

export default function Admin() {
  return (
    process.browser && (
      <Dashboard<EntryOf<typeof schema>>
        name="web"
        schema={schema}
        apiUrl="/api/cms"
        auth={PasswordLessLogin}
        preview={Preview}
      />
    )
  )
}
