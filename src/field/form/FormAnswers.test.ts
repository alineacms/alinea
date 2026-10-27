import type {Submission} from '#/core/Connection.js'
import {expect, test} from 'bun:test'
import {answerGroups, submissionsCsv} from './FormAnswers.js'
import type {FormDefinition} from './FormDefinition.js'

const definition: FormDefinition = [
  {
    id: 'about',
    type: 'section',
    label: 'About you',
    control: 'section',
    inputs: [
      {
        id: 'name',
        type: 'text',
        label: 'Name',
        control: 'input',
        key: 'name',
        required: true,
        width: 'full',
        attributes: {},
        settings: {}
      },
      {
        id: 'phone',
        type: 'tel',
        label: 'Phone',
        control: 'input',
        key: 'phone',
        required: false,
        width: 'full',
        attributes: {},
        settings: {}
      }
    ]
  },
  {
    id: 'service',
    type: 'radio',
    label: 'Service',
    control: 'radio',
    key: 'service',
    required: true,
    width: 'full',
    attributes: {},
    settings: {},
    choices: [
      {id: 'it', label: 'IT', value: 'it'},
      {id: 'fac', label: 'Facilities', value: 'facilities'}
    ]
  },
  {
    id: 'room',
    type: 'text',
    label: 'Room number',
    control: 'input',
    key: 'room',
    required: false,
    width: 'full',
    attributes: {},
    settings: {},
    showWhen: {
      match: 'all',
      rules: [{input: 'service', op: 'is', value: ['facilities']}]
    }
  }
]

const submission: Submission = {
  id: 's1',
  entryId: 'form',
  locale: null,
  field: 'inputs',
  values: {name: 'Ann, "the" tester', service: 'it'},
  definition,
  createdAt: 1792800000,
  status: 'new'
}

test('answers are grouped and tell hidden from empty', () => {
  const groups = answerGroups(definition, submission.values)
  expect(
    groups.map(group => [
      group.title,
      group.answers.map(answer => [answer.input.key, answer.text, answer.state])
    ])
  ).toEqual([
    [
      'About you',
      [
        ['name', 'Ann, "the" tester', 'answered'],
        ['phone', '', 'empty']
      ]
    ],
    [
      undefined,
      [
        ['service', 'IT', 'answered'],
        ['room', '', 'hidden']
      ]
    ]
  ])
})

test('csv has a column per input and quotes what needs it', () => {
  const csv = submissionsCsv(definition, [
    submission,
    {...submission, id: 's2', values: {name: '=1+1', service: 'facilities'}}
  ])
  expect(csv.split('\r\n')).toEqual([
    '﻿Received,Status,Language,Page,Name,Phone,Service,Room number',
    '2026-10-24T00:00:00.000Z,new,,,"Ann, ""the"" tester",,IT,',
    "2026-10-24T00:00:00.000Z,new,,,'=1+1,,Facilities,",
    ''
  ])
})
