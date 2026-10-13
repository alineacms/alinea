import {suite} from '@alinea/suite'
import {isSeparator, slugify} from '#/core/util/Slugs.js'

const test = suite(import.meta)

test('latin', () => {
  const cases = [
    ['a b c', 'a-b-c'],
    ['A-B  c', 'a-b-c'],
    ['a\tb\nc\rd', 'a-b-c-d'],
    ['a1b2c', 'a1b2c'],
    ['a«b»c', 'a-b-c'],
    ['a“b”c 😊', 'a-b-c-😊'],
    [
      'a!b@c#$d%e^f&g*h(i)j-k_l+m=n_o[p]q{r}',
      'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r'
    ],
    ["that's", 'thats']
  ]
  for (const [input, slug] of cases) test.is(slugify(input), slug)
})

test('soft hyphens', () => {
  test.is(slugify('Hyphen\u00adation in\u00adside'), 'hyphenation-inside')
  test.is(isSeparator('\u00ad'), false)
})

test('accented', () => {
  test.is(slugify('àáâäå'), 'aaaaa')
  test.is(slugify('Ångström'), 'angstrom')
  test.is(slugify('Crème brûlée'), 'creme-brulee')
})

test('unicode scripts and emojis', () => {
  test.is(slugify('中文 測試'), '中文-測試')
  test.is(slugify('Привет мир'), 'привет-мир')
  test.is(slugify('مرحبا بالعالم'), 'مرحبا-بالعالم')
  test.is(slugify('日本語テスト'), '日本語テスト')
  test.is(slugify('Hello 😀👍🏽 World'), 'hello-😀👍🏽-world')
  test.is(slugify('family 👨‍👩‍👧‍👦 test'), 'family-👨‍👩‍👧‍👦-test')
  // sequences
  test.is(
    slugify('👮🏿 👍🏽 🕵🏻 💃👩🏿‍🤝‍👩🏼 🐕‍🦺 👨‍👩‍👧‍👦 🏳️‍🌈 👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏴󠁧󠁢󠁷󠁬󠁳*️⃣ 5️⃣ #️⃣ 9️⃣'),
    '👮🏿-👍🏽-🕵🏻-💃👩🏿‍🤝‍👩🏼-🐕‍🦺-👨‍👩‍👧‍👦-🏳️‍🌈-👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿-🏴󠁧󠁢󠁳󠁣󠁴󠁿-🏴󠁧󠁢󠁷󠁬󠁳*️⃣-5️⃣-#️⃣-9️⃣'
  )
})

test('combining marks in non-latin scripts', () => {
  test.is(slugify('हिंदी भाषा'), 'हिंदी-भाषा')
  test.is(slugify('ภาษาไทย'), 'ภาษาไทย')
})

test('isSeparator is stable across calls', () => {
  test.is(isSeparator('-'), true)
  test.is(isSeparator('-'), true)
  test.is(isSeparator('a'), false)
  test.is(isSeparator('a'), false)
})
