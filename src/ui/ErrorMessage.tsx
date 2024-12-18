import {IcRoundWarning} from './icons/IcRoundWarning.js'
import {HStack} from './Stack.js'
import {Typo} from './Typo.js'
import {px} from './util/Units.js'

export type ErrorMessageProps = {
  error: Error | string
}

export function ErrorMessage({error}: ErrorMessageProps) {
  return (
    <HStack center gap={10} style={{padding: px(25), width: '100%'}}>
      <IcRoundWarning style={{fontSize: px(20)}} />
      <Typo.Monospace>
        {typeof error === 'string' ? error : error.message}
      </Typo.Monospace>
    </HStack>
  )
}
