import {MdWarning} from 'react-icons/md'
import {HStack} from './Stack'
import {Typo} from './Typo'
import {px} from './util/Units'

export type ErrorMessageProps = {
  error: Error
}

export function ErrorMessage({error}: ErrorMessageProps) {
  return (
    <HStack center gap={10} style={{padding: px(25), width: '100%'}}>
      <MdWarning size={20} />
      <Typo.Monospace>Error: {error.message}</Typo.Monospace>
    </HStack>
  )
}
