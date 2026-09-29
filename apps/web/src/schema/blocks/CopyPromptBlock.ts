import {Config, Field} from 'alinea'

export const CopyPromptBlock = Config.type('Copy prompt', {
  fields: {
    prompt: Field.text('Prompt', {
      required: true,
      help: 'A one-line prompt readers paste into their coding agent'
    })
  }
})
