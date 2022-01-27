import {HubClient} from '@alinea/client'
import {Auth, Session} from '@alinea/core'
import {useDashboard} from '@alinea/dashboard'
import {Button, fromModule, Loader, Logo, px, Typo} from '@alinea/ui'
import {HStack, VStack} from '@alinea/ui/Stack'
import jwtDecode from 'jwt-decode'
import {FormEvent, PropsWithChildren, useLayoutEffect, useState} from 'react'
import Helmet from 'react-helmet'
import {MdArrowBack, MdArrowForward} from 'react-icons/md'
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
  NotFound,
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
            <Button size="large" type="submit">
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

type LoginScreenProps = {
  state: LoginState
  setState: (state: LoginState) => void
} & LoginFormProps

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
    case LoginState.NotFound:
      return (
        <LoginBox>
          <LoginHeader>Oops</LoginHeader>
          <Typo.P flat>
            The email adress &quot;{props.email}&quot; is not known
          </Typo.P>
          <div>
            <Button onClick={() => props.setState(LoginState.Input)}>
              <HStack center gap={8}>
                <MdArrowBack />
                <span>Try again</span>
              </HStack>
            </Button>
          </div>
        </LoginBox>
      )
    case LoginState.Error:
      return (
        <LoginBox>
          <LoginHeader>Oops</LoginHeader>
          <Typo.P>Something went wrong, please try again later</Typo.P>
        </LoginBox>
      )
  }
}

function useResolveToken(setSession: (session: Session | undefined) => void) {
  const {schema, apiUrl} = useDashboard()
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isTokenFromUrl = params.has('token')
    const token =
      params.get('token') || localStorage.getItem('@alinea/auth.passwordless')
    if (token) {
      const user: any = token && jwtDecode(token)
      function logout() {
        localStorage.removeItem('@alinea/auth.passwordless')
        setSession(undefined)
      }
      function applyAuth(init?: RequestInit) {
        return {
          ...init,
          headers: {...init?.headers, authorization: `Bearer ${token}`}
        }
      }
      setSession({
        user,
        hub: new HubClient(schema, apiUrl, applyAuth, logout),
        end: async () => logout()
      })
      if (isTokenFromUrl) {
        localStorage.setItem('@alinea/auth.passwordless', token)
        history.pushState(null, '', window.location.pathname)
      }
    }
  }, [])
}

export function PasswordLessLogin({setSession}: Auth.ViewProps) {
  const {color, apiUrl} = useDashboard()
  const [state, setState] = useState(LoginState.Input)
  const [email, setEmail] = useState('')

  useResolveToken(setSession)

  function handleSubmit() {
    setState(LoginState.Loading)
    fetch(`${apiUrl}/auth.passwordless`, {
      headers: {'content-type': 'application/json'},
      method: 'POST',
      body: JSON.stringify({email})
    })
      .then(res => {
        switch (res.status) {
          case 200:
            return setState(LoginState.Sent)
          case 404:
            return setState(LoginState.NotFound)
          default:
            return setState(LoginState.Error)
        }
      })
      .catch(() => {
        setState(LoginState.Error)
      })
  }

  return (
    <>
      <Helmet>
        <title>Log in</title>
      </Helmet>
      <div style={{display: 'flex', height: '100%', width: '100%'}}>
        <div style={{margin: 'auto', padding: px(20)}}>
          <LoginScreen
            state={state}
            setState={setState}
            onSubmit={handleSubmit}
            email={email}
            setEmail={setEmail}
          />
        </div>
      </div>
    </>
  )
}
