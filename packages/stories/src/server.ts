import {PasswordLessAuth} from '@alinea/auth.passwordless/PasswordLessAuth'
import {LocalHub, Server} from '@alinea/server'
import dotenv from 'dotenv'
import {createTransport} from 'nodemailer'
import {mySchema} from './schema'

dotenv.config({path: '../../.env'})

const server = new Server({
  auth: new PasswordLessAuth({
    dashboardUrl: 'http://localhost:8000',
    subject: 'Login',
    from: `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_FROM_ADDRESS}>`,
    transporter: createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD
      }
    }),
    jwtSecret: 'secret'
  }),
  hub: new LocalHub(mySchema, './content')
})

server.listen(4500)

// Todo: "build": "alinea track-build -- next build"
