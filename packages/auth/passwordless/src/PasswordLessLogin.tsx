import {Auth} from '@alinea/core'
import {useDashboard} from '@alinea/dashboard'
import {
  Button,
  FavIcon,
  fromModule,
  Loader,
  Logo,
  px,
  Typo,
  Viewport
} from '@alinea/ui'
import {HStack, VStack} from '@alinea/ui/Stack'
import {FormEvent, PropsWithChildren, useEffect, useState} from 'react'
import Helmet from 'react-helmet'
import {MdArrowForward} from 'react-icons/md'
import {RiFlashlightFill} from 'react-icons/ri'
import css from './PasswordLessLogin.module.scss'

const styles = fromModule(css)

// Todo: make fields easily available externally
// Maybe something like?
// const {email} = useFields({email: text('Email')})
// handleSubmit() {console.log(email.value)}
// <Input {...email} />

const enum LoginState {
  Loading,
  Input,
  Sent,
  Error
}

function LoginBox({children}: PropsWithChildren<{}>) {
  return (
    <div style={{width: px(320)}}>
      <VStack gap={16}>{children}</VStack>
    </div>
  )
}

function LoginHeader({children}: PropsWithChildren<{}>) {
  return (
    <HStack center gap={16}>
      <Logo>
        <RiFlashlightFill />
      </Logo>
      <Typo.H1 flat>{children}</Typo.H1>
    </HStack>
  )
}

type LoginFormProps = {
  onSubmit: () => void
  email: string
  setEmail: (email: string) => void
}

function LoginForm({onSubmit, email, setEmail}: LoginFormProps) {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit()
  }
  return (
    <form onSubmit={handleSubmit}>
      <LoginBox>
        <LoginHeader>Log in</LoginHeader>
        <VStack gap={10}>
          <Typo.P flat>We&apos;ll send you a login link by mail.</Typo.P>
          <HStack center gap={16}>
            <div className={styles.root.email()}>
              <input
                className={styles.root.email.input()}
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit">
              <HStack center gap={8}>
                <span>Sign in</span>
                <MdArrowForward />
              </HStack>
            </Button>
          </HStack>
        </VStack>
      </LoginBox>
    </form>
  )
}

type LoginScreenProps = {state: LoginState} & LoginFormProps

function LoginScreen(props: LoginScreenProps) {
  switch (props.state) {
    case LoginState.Loading:
      return <Loader />
    case LoginState.Input:
      return <LoginForm {...props} />
    case LoginState.Sent:
      return (
        <LoginBox>
          <LoginHeader>Check your email</LoginHeader>
          <Typo.P>We&apos;ve sent you link at {props.email}</Typo.P>
        </LoginBox>
      )
    case LoginState.Error:
      return (
        <LoginBox>
          <LoginHeader>Oops, something went wrong</LoginHeader>
          <Typo.P>Please try again later</Typo.P>
        </LoginBox>
      )
  }
}

export function PasswordLessLogin({setSession}: Auth.ViewProps) {
  const {apiUrl} = useDashboard()
  const [state, setState] = useState(LoginState.Loading)
  const [email, setEmail] = useState('')
  function handleSubmit() {
    setState(LoginState.Sent)
    fetch(`${apiUrl}/auth.passwordless`, {
      headers: {'content-type': 'application/json'},
      method: 'POST',
      body: JSON.stringify({email})
    }).catch(() => {
      setState(LoginState.Error)
    })
  }
  useEffect(() => {
    fetch(`${apiUrl}/auth.passwordless`).then(res => {
      if (res.status === 200) {
        // Set session
      }
      setState(LoginState.Input)
    })
  }, [])
  return (
    <Viewport>
      <FavIcon color="#FFBD67" />
      <Helmet>
        <title>Log in</title>
      </Helmet>
      <div style={{display: 'flex', height: '100%', width: '100%'}}>
        <div style={{margin: 'auto', padding: px(20)}}>
          <LoginScreen
            state={state}
            onSubmit={handleSubmit}
            email={email}
            setEmail={setEmail}
          />
        </div>
      </div>
    </Viewport>
  )
}

export const usePasswordLessLogin: Auth.Hook = () => {
  return {view: PasswordLessLogin}
}
