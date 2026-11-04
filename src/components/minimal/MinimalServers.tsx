import { useMemo, useState } from 'react'
import { Icon } from '../Icon'
import { quickJoin } from '../../lib/joinServer'
import { canonAddr } from '../../lib/serverAddr'
import { showToast } from '../../state/ui'
import { useT } from '../../i18n'

type SavedServer = { id: string; name: string; address: string }
const STORAGE_KEY = 'minimal-launcher.saved-servers.v1'

function readServers(): SavedServer[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((s): s is SavedServer =>
      !!s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.address === 'string' &&
      s.name.length <= 48 && s.address.length <= 255,
    ).slice(0, 50)
  } catch {
    return []
  }
}

function validAddress(value: string): boolean {
  const address = value.trim()
  if (!address || address.length > 255 || /[\s/\\?#@]/.test(address)) return false
  const m = /^(?:\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(address)
  if (!m) return false
  if (m[1]) {
    const port = Number(m[1])
    if (!Number.isInteger(port) || port < 1 || port > 65535) return false
  }
  return true
}

export function MinimalServers() {
  const t = useT()
  const [servers, setServers] = useState<SavedServer[]>(readServers)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const sorted = useMemo(() => servers.slice(), [servers])

  const save = (next: SavedServer[]) => {
    setServers(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { showToast(t('Не удалось сохранить список серверов'), 'error') }
  }

  const add = () => {
    const addr = address.trim()
    if (!validAddress(addr)) {
      showToast(t('Проверь адрес сервера и порт'), 'error')
      return
    }
    if (servers.some((s) => canonAddr(s.address) === canonAddr(addr))) {
      showToast(t('Этот сервер уже добавлен'), 'error')
      return
    }
    const host = addr.replace(/^\[|\](:\d+)?$/g, '')
    const next = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: name.trim().slice(0, 48) || host, address: addr }, ...servers].slice(0, 50)
    save(next)
    setName('')
    setAddress('')
  }

  const join = async (server: SavedServer) => {
    if (busy) return
    setBusy(server.id)
    try {
      await quickJoin(server.address, server.name, false)
    } catch (e) {
      const message = String(e instanceof Error ? e.message : e)
      if (!/no-profile|cancel/i.test(message)) showToast(t('Не удалось подключиться: {error}', { error: message }), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="ml-service-page">
      <header className="ml-home-header">
        <div><div className="ml-eyebrow">MINECRAFT MULTIPLAYER</div><h1>{t('Серверы')}</h1></div>
      </header>
      <div className="ml-local-panel">
        <div className="ml-section-heading"><div><h2>{t('Добавить сервер')}</h2><p>{t('Список хранится только на этом компьютере.')}</p></div></div>
        <div className="ml-server-form">
          <label><span>{t('Название')}</span><input value={name} onChange={(e) => setName(e.target.value)} maxLength={48} placeholder={t('Например, Сервер друзей')} /></label>
          <label><span>{t('Адрес сервера')}</span><input value={address} onChange={(e) => setAddress(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} maxLength={255} placeholder="play.example.net:25565" /></label>
          <button className="ml-action-primary" onClick={add}><Icon id="i-plus" /> {t('Добавить')}</button>
        </div>
      </div>
      <div className="ml-section ml-local-panel">
        <div className="ml-section-heading"><div><h2>{t('Мои серверы')}</h2><p>{t('Сохранённые адреса Minecraft')}</p></div></div>
        {sorted.length ? <div className="ml-server-list">{sorted.map((server) => (
          <div className="ml-server-row" key={server.id}>
            <span className="ml-server-icon"><Icon id="i-server" /></span>
            <span className="ml-server-copy"><b>{server.name}</b><small>{server.address}</small></span>
            <button className="ml-action-primary" onClick={() => void join(server)} disabled={!!busy}><Icon id="i-play" /> {busy === server.id ? t('Подключаемся…') : t('Играть')}</button>
            <button className="ml-icon-button" title={t('Удалить')} aria-label={t('Удалить')} onClick={() => save(servers.filter((s) => s.id !== server.id))}><Icon id="i-trash" /></button>
          </div>
        ))}</div> : <div className="ml-empty-state"><span><Icon id="i-server" /></span><div><b>{t('Пока нет сохранённых серверов')}</b><p>{t('Добавь адрес сверху. При подключении лаунчер проверит версию сервера и поможет подготовить сборку.')}</p></div></div>}
      </div>
      <p className="ml-local-note">{t('Каталог серверов и облачный хостинг пока не подключены. Сохранённые адреса и обычное подключение работают локально.')}</p>
    </section>
  )
}

export function MinimalFriends() {
  const t = useT()
  const [nicknames, setNicknames] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('minimal-launcher.local-friends.v1') || '[]')
      return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === 'string' && /^[A-Za-z0-9_]{3,16}$/.test(s)).slice(0, 50) : []
    } catch { return [] }
  })
  const [nick, setNick] = useState('')
  const save = (next: string[]) => {
    setNicknames(next)
    try { localStorage.setItem('minimal-launcher.local-friends.v1', JSON.stringify(next)) } catch { showToast(t('Не удалось сохранить список'), 'error') }
  }
  const add = () => {
    const value = nick.trim()
    if (!/^[A-Za-z0-9_]{3,16}$/.test(value)) { showToast(t('Ник должен содержать 3–16 латинских букв, цифр или подчёркиваний'), 'error'); return }
    if (nicknames.some((x) => x.toLowerCase() === value.toLowerCase())) { showToast(t('Этот ник уже добавлен'), 'error'); return }
    save([...nicknames, value].slice(0, 50))
    setNick('')
  }
  return (
    <section className="ml-service-page">
      <header className="ml-home-header"><div><div className="ml-eyebrow">LOCAL CONTACTS</div><h1>{t('Друзья')}</h1></div></header>
      <div className="ml-local-panel">
        <div className="ml-section-heading"><div><h2>{t('Игроки')}</h2><p>{t('Локальный список ников на этом компьютере.')}</p></div></div>
        <div className="ml-server-form ml-friend-form">
          <label><span>{t('Ник Minecraft')}</span><input value={nick} onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} maxLength={16} placeholder="Steve_123" /></label>
          <button className="ml-action-primary" onClick={add}><Icon id="i-plus" /> {t('Добавить')}</button>
        </div>
        {nicknames.length ? <div className="ml-server-list">{nicknames.map((value) => <div className="ml-server-row" key={value}><span className="ml-server-icon"><Icon id="i-user" /></span><span className="ml-server-copy"><b>{value}</b><small>{t('Локальный контакт')}</small></span><button className="ml-icon-button" title={t('Удалить')} aria-label={t('Удалить')} onClick={() => save(nicknames.filter((x) => x !== value))}><Icon id="i-trash" /></button></div>)}</div> : <div className="ml-empty-state"><span><Icon id="i-users" /></span><div><b>{t('Список пока пуст')}</b><p>{t('Добавь ники игроков, чтобы сохранить их здесь.')}</p></div></div>}
      </div>
      <p className="ml-local-note">{t('Это локальный список ников, а не онлайн-друзья. Чаты, звонки и синхронизация пока не подключены.')}</p>
    </section>
  )
}
