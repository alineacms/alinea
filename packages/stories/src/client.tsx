//import {PasswordLessLogin} from '@alineacms/auth.passwordless/PasswordLessLogin'
import {Client} from '@alineacms/client'
import '@alineacms/css/global.css'
import {renderDashboard} from '@alineacms/dashboard'
import {config} from '../../website/.alinea/config'

renderDashboard({
  config,
  client: new Client(config, 'http://localhost:4500')
})
