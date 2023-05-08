import {Client} from 'alinea/client'
import {Auth, Connection, Session, createError} from 'alinea/core'
import {decode} from 'alinea/core/util/JWT'
import {joinPaths} from 'alinea/core/util/Urls'
import {useDashboard} from 'alinea/dashboard/hook/UseDashboard'
import {Head} from 'alinea/dashboard/util/Head'
import {Button, Loader, LogoShape, Typo, fromModule, px} from 'alinea/ui'
import {HStack, VStack} from 'alinea/ui/Stack'
import {IcRoundArrowBack} from 'alinea/ui/icons/IcRoundArrowBack'
import {IcRoundArrowForward} from 'alinea/ui/icons/IcRoundArrowForward'
import {RiFlashlightFill} from 'alinea/ui/icons/RiFlashlightFill'
import {FormEvent, PropsWithChildren, useLayoutEffect, useState} from 'react'
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
      <LogoShape>
        <RiFlashlightFill />
      </LogoShape>
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
                <IcRoundArrowForward />
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
                <IcRoundArrowBack />
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
  const {client} = useDashboard()
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isTokenFromUrl = params.has('token')
    const token =
      params.get('token') || localStorage.getItem('@alinea/auth.passwordless')
    if (token) {
      const user: any = token && decode(token)
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
      if (!(client instanceof Client))
        throw createError(`Cannot authenticate with non http client`)
      setSession({
        user,
        cnx: client.authenticate(applyAuth, logout),
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
  const {client} = useDashboard()
  const [state, setState] = useState(LoginState.Input)
  const [email, setEmail] = useState('')

  useResolveToken(setSession)

  function handleSubmit() {
    setState(LoginState.Loading)
    if (!(client instanceof Client))
      throw createError(`Cannot authenticate with non http client`)
    fetch(joinPaths(client.url, Connection.routes.base, `/auth.passwordless`), {
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
      <Head>
        <title>Log in</title>
      </Head>
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
