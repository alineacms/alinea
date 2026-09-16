const $ = id => document.getElementById(id)
const logEl = $('log')
let selectedId = null
let page = 0
const PAGE_SIZE = 20

function log(message, cls = 'ok') {
  const div = document.createElement('div')
  div.className = cls
  const time = new Date().toLocaleTimeString('en-GB')
  div.innerHTML = `<time>${time}</time>${message}`
  logEl.prepend(div)
}

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

async function refreshStatus() {
  const res = await fetch('/api/status').then(r => r.json())
  $('stat-entries').textContent = res.entries.toLocaleString()
  $('stat-revision').textContent = res.revision
  $('stat-bytes').textContent = fmtBytes(res.databaseBytes)
  $('stat-remote').textContent = res.remoteFiles.toLocaleString()
  return res
}

async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: body ? JSON.stringify(body) : '{}'
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}

async function loadEntries() {
  const q = $('search').value.trim()
  const params = new URLSearchParams({take: PAGE_SIZE, skip: page * PAGE_SIZE})
  if (q) params.set('search', q)
  const data = await fetch('/api/entries?' + params).then(r => r.json())
  const body = $('entries-body')
  body.innerHTML = ''
  for (const row of data.rows) {
    const tr = document.createElement('tr')
    if (row.id === selectedId) tr.className = 'selected'
    tr.innerHTML = `<td class="id">${row.id}</td><td>${row.title ?? ''}</td><td>${row.score ?? ''}</td><td>${row.status ?? ''}</td><td class="id">${row.parentId ?? ''}</td>`
    tr.onclick = () => selectEntry(row.id)
    body.appendChild(tr)
  }
  $('page-label').textContent = `page ${page + 1}`
  $('query-meta').innerHTML = `returned <b>${data.rows.length}</b> rows in <b>${data.ms} ms</b>${q ? ` for “${q}”` : ''}`
}

async function selectEntry(id) {
  selectedId = id
  await loadEntries()
  const data = await fetch('/api/relations?id=' + encodeURIComponent(id)).then(r => r.json())
  const row = data.row
  const fmt = list => Array.isArray(list) ? (list.length ? list.join(', ') : '—') : String(list ?? '—')
  $('detail').innerHTML =
    `<b>${row.id}</b> — ${row.title ?? ''}<br>` +
    `parent: ${fmt(row.parent)}<br>children: ${fmt(row.children)}<br>siblings: ${fmt(row.siblings)}<br>` +
    `looked up in <b>${data.ms} ms</b>`
  $('mutate-result').textContent = `Selected ${id}.`
  log(`selected ${id}`)
}

async function refreshAll() {
  await refreshStatus()
  await loadEntries()
}

// --- remote editing ---
document.querySelectorAll('[data-remote]').forEach(button => {
  button.onclick = async () => {
    const action = button.dataset.remote
    button.disabled = true
    try {
      if (action === 'add') {
        const data = await api('/api/remote-add', {title: 'New doc ' + Math.floor(Math.random() * 10000)})
        $('remote-result').innerHTML = `staged <b>${data.id}</b> on the remote — press Sync.`
        log(`staged remote add ${data.id}`)
      } else {
        const status = await refreshStatus()
        void status
        const sample = await fetch('/api/entries?take=200').then(r => r.json()).then(d => d.rows)
        if (!sample.length) throw new Error('store is empty')
        const pick = sample[Math.floor(Math.random() * sample.length)]
        if (action === 'edit') {
          await api('/api/remote-edit', {id: pick.id, set: {title: pick.title + ' (edited)'}})
          $('remote-result').innerHTML = `staged retitle of <b>${pick.id}</b> — press Sync.`
          log(`staged remote edit ${pick.id}`)
        } else {
          await api('/api/remote-remove', {id: pick.id})
          $('remote-result').innerHTML = `staged removal of <b>${pick.id}</b> — press Sync.`
          log(`staged remote remove ${pick.id}`)
        }
      }
      await refreshStatus()
    } catch (error) {
      $('remote-result').innerHTML = `<span class="err">${error.message}</span>`
      log(error.message, 'err')
    }
    button.disabled = false
  }
})

$('btn-sync').onclick = async e => {
  const button = e.currentTarget
  button.disabled = true
  try {
    const data = await api('/api/sync')
    $('sync-result').innerHTML =
      `synced in <b>${data.syncMs} ms</b> — <b>${data.entries}</b> entries, ` +
      `sqlite <b>${fmtBytes(data.databaseBytes)}</b>, revision <b>${data.revision}</b>`
    log(`sync ${data.syncMs} ms → ${data.entries} entries`)
    await refreshAll()
  } catch (error) {
    $('sync-result').innerHTML = `<span class="err">${error.message}</span>`
    log(error.message, 'err')
  }
  button.disabled = false
}

// --- queries ---
let searchTimer = null
$('search').oninput = () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page = 0; loadEntries() }, 250)
}
document.querySelectorAll('[data-query]').forEach(button => {
  button.onclick = async () => {
    if (button.dataset.query === 'children') {
      const data = await fetch('/api/relations?id=home').then(r => r.json())
      $('query-meta').innerHTML = `children of home: <b>${(data.row.children || []).join(', ') || '—'}</b> in <b>${data.ms} ms</b>`
      log(`children of home in ${data.ms} ms`)
    } else {
      $('search').value = ''
      page = 0
      await loadEntries()
    }
  }
})
$('page-prev').onclick = () => { if (page > 0) { page -= 1; loadEntries() } }
$('page-next').onclick = () => { page += 1; loadEntries() }

// --- mutations ---
document.querySelectorAll('[data-mutate]').forEach(button => {
  button.onclick = async () => {
    if (!selectedId && button.dataset.mutate !== 'create') {
      $('mutate-result').textContent = 'Select a row above first.'
      return
    }
    button.disabled = true
    try {
      const action = button.dataset.mutate
      let mutation
      if (action === 'rename') mutation = {op: 'update', id: selectedId, status: 'published', set: {title: 'Renamed ' + Date.now().toString(36)}}
      else if (action === 'move') mutation = {op: 'move', id: selectedId, target: 'recipes', dropPosition: 'on'}
      else if (action === 'unpublish') mutation = {op: 'unpublish', id: selectedId}
      else if (action === 'publish') mutation = {op: 'publish', id: selectedId, status: 'draft'}
      else if (action === 'remove') mutation = {op: 'remove', id: selectedId}
      else if (action === 'create') mutation = {op: 'create', type: 'Doc', parentId: selectedId, data: {title: 'Fresh doc', path: 'fresh-' + Date.now().toString(36)}}
      const data = await api('/api/mutate', mutation)
      $('mutate-result').innerHTML = `done in <b>${data.ms} ms</b>, sha <b>${data.sha}</b>`
      log(`mutate ${mutation.op} ${selectedId ?? ''} in ${data.ms} ms`)
      await refreshAll()
      if (selectedId) await selectEntry(selectedId).catch(() => { selectedId = null })
    } catch (error) {
      $('mutate-result').innerHTML = `<span class="err">${error.message}</span>`
      log(error.message, 'err')
    }
    button.disabled = false
  }
})

// --- scale lab ---
document.querySelectorAll('[data-seed]').forEach(button => {
  button.onclick = async () => {
    const count = Number(button.dataset.seed)
    button.disabled = true
    $('seed-result').textContent = `seeding ${count.toLocaleString()} docs…`
    try {
      const data = await api('/api/seed', {count})
      $('seed-result').innerHTML =
        `built remote in <b>${data.buildMs} ms</b>, synced in <b>${data.syncMs} ms</b> — ` +
        `<b>${data.entries.toLocaleString()}</b> entries, sqlite <b>${fmtBytes(data.databaseBytes)}</b>`
      log(`seed ${count.toLocaleString()} → sync ${data.syncMs} ms, ${fmtBytes(data.databaseBytes)}`)
      page = 0
      await refreshAll()
    } catch (error) {
      $('seed-result').innerHTML = `<span class="err">${error.message}</span>`
      log(error.message, 'err')
    }
    button.disabled = false
  }
})

$('btn-reset').onclick = async () => {
  await api('/api/reset')
  selectedId = null
  page = 0
  await refreshAll()
  log('reset')
}

refreshAll().then(() => log('playground ready'))
