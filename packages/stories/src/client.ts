import {usePasswordLessLogin} from '@alinea/auth.passwordless/PasswordLessLogin'
import {Dashboard} from '@alinea/dashboard'

const dashboard = new Dashboard({
  apiUrl: 'http://localhost:4500',
  color: '#FFBD67',
  useAuth: usePasswordLessLogin
})

dashboard.render()
