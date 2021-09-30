import {usePasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Dashboard} from '@alinea/dashboard'

const dashboard = new Dashboard({
  api: 'http://localhost:4500',
  useAuth: usePasswordLessLogin
})

dashboard.render()
