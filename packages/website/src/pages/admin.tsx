import {schema} from '.alinea'
import {PasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {EntryOf} from '@alinea/core'
import Dashboard from '@alinea/dashboard'

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
        /*preview={entry => {
          return <PageView {...entry} />
        }}*/
      />
    )
  )
}
