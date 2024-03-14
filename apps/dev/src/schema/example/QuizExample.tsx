import {Config, Field} from 'alinea'

const Answer = Config.document('Answer', {
  fields: {
    correct: Field.check('Is correct', {width: 0.25}),
    label: Field.text('Label', {multiline: true, width: 0.75})
  }
})
const answers = Field.list('Answers', {
  schema: {Answer},
  validate(value) {
    const hasCorrect = value.some(answer => answer.correct)
    if (!hasCorrect) return 'At least one answer must be correct'
  }
})

export const QuizExamples = Config.type('Quiz', {
  fields: {answers}
})
