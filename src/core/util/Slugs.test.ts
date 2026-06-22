import {suite} from '@alinea/suite'
import {isSeparator, slugify} from '#/core/util/Slugs.js'

const test = suite(import.meta)

test('slugs', () => {
  test.is(slugify('a b c'), 'a-b-c')
  test.is(slugify('A-B  c'), 'a-b-c')
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

test('emojis', () => {
  // sequences
  test.is(
    slugify('👮🏿 👍🏽 🕵🏻 💃👩🏿‍🤝‍👩🏼 🐕‍🦺 👨‍👩‍👧‍👦 🏳️‍🌈 👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏴󠁧󠁢󠁷󠁬󠁳*️⃣ 5️⃣ #️⃣ 9️⃣'),
    '👮🏿-👍🏽-🕵🏻-💃👩🏿‍🤝‍👩🏼-🐕‍🦺-👨‍👩‍👧‍👦-🏳️‍🌈-👨‍👩‍👧‍🇬🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿-🏴󠁧󠁢󠁳󠁣󠁴󠁿-🏴󠁧󠁢󠁷󠁬󠁳*️⃣-5️⃣-#️⃣-9️⃣'
  )
})

test('punctuation', () => {
  test.is(slugify('a«b»c'), 'a-b-c')
  test.is(slugify('a“b”c 😊'), 'a-b-c-😊')
})

test('numbers', () => {
  test.is(slugify('a1b2c'), 'a1b2c')
})

test('whitespace', () => {
  test.is(slugify('a b c'), 'a-b-c')
  test.is(slugify('a\tb\tc'), 'a-b-c')
  test.is(slugify('a\nb\nc'), 'a-b-c')
  test.is(slugify('a\rb\rc'), 'a-b-c')
})

test('symbols', () => {
  test.is(
    slugify('a!b@c#$d%e^f&g*h(i)j-k_l+m=n_o[p]q{r}'),
    'a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r'
  )
  test.is(slugify("that's"), 'thats')
})
