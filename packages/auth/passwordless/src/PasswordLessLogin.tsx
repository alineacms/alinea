import {Auth} from '@alinea/core'
import {Button, fromModule, Logo, Typo, Viewport} from '@alinea/ui'
import {HStack, VStack} from '@alinea/ui/Stack'
import {FormEvent, useState} from 'react'
import {MdArrowForward} from 'react-icons/md'
import {RiFlashlightFill} from 'react-icons/ri'
import css from './PasswordLessLogin.module.scss'

const styles = fromModule(css)

// Todo: make fields easily available externally
// Maybe something like?
// const {email} = useFields({email: text('Email')})
// handleSubmit() {console.log(email.value)}
// <Input {...email} />

export function PasswordLessLogin({setToken}: Auth.ViewProps) {
  const [email, setEmail] = useState('')
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    fetch('/auth.passwordless', {
      method: 'POST',
      body: JSON.stringify({email})
    }).then()
  }
  return (
    <Viewport>
      <div style={{display: 'flex', height: '100%', width: '100%'}}>
        <div style={{margin: 'auto'}}>
          <form onSubmit={handleSubmit}>
            <VStack gap={16}>
              <HStack center gap={16}>
                <Logo>
                  <RiFlashlightFill />
                </Logo>
                <Typo.H1 flat>Log in</Typo.H1>
              </HStack>
              <div>
                <Typo.P>We&apos;ll send you a login link by mail.</Typo.P>
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
              </div>
            </VStack>
          </form>
        </div>
      </div>
    </Viewport>
  )
}

export const usePasswordLessLogin: Auth.Hook = () => {
  return {view: PasswordLessLogin}
}
