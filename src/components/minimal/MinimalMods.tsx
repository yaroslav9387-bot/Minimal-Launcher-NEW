import { useEffect, useState } from 'react'
import { Icon } from '../Icon'
import { useMods, type ModHit } from '../../state/mods'
import { installContentFlow } from '../../lib/install'
import { useProfiles } from '../../state/profiles'
import { showToast } from '../../state/ui'
import { useT } from '../../i18n'

type ModKind = 'mod' | 'resourcepack' | 'shader' | 'datapack'
const TABS: { id: ModKind; label: string }[] = [
  { id: 'mod', label: 'Моды' },
  { id: 'resourcepack', label: 'Ресурспаки' },
  { id: 'shader', label: 'Шейдеры' },
  { id: 'datapack', label: 'Датапаки' },
]

export function MinimalMods() {
  const t = useT()
  const tab = useMods((s) => s.modTab)
  const query = useMods((s) => s.mq)
  const hits = useMods((s) => s.hits)
  const notice = useMods((s) => s.notice)
  const count = useMods((s) => s.count)
  const more = useMods((s) => s.showMore)
  const profiles = useProfiles((s) => s.profiles)
  const selected = useProfiles((s) => s.selected)
  const targetBuild = useMods((s) => s.targetBuild)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    const store = useMods.getState()
    store.set({ modSource: 'modrinth', modTab: 'mod', mq: '', hits: [], notice: '', targetBuild: selected || null })
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void useMods.getState().load(), query.trim() ? 350 : 0)
    return () => window.clearTimeout(timer)
  }, [query, tab, targetBuild])

  const pickTab = (next: ModKind) => {
    useMods.getState().set({ modSource: 'modrinth', modTab: next, mq: '', hits: [], notice: '', offset: 0, cfOffset: 0 })
  }

  const pickBuild = (name: string) => {
    useMods.getState().scopeTo(name || null)
    useMods.getState().set({ modSource: 'modrinth' })
  }

  const install = async (hit: ModHit) => {
    if (!hit.slug || busy) return
    const id = hit.pid || hit.slug
    setBusy(id)
    try {
      await installContentFlow({ source: 'modrinth', slug: hit.slug }, tab, hit.title, targetBuild || selected || undefined)
    } catch (error) {
      showToast(t('Не удалось установить: {error}', { error: String(error) }), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="ml-service-page ml-mods-page">
      <header className="ml-home-header">
        <div><div className="ml-eyebrow">MODRINTH CATALOG</div><h1>{t('Моды и контент')}</h1><p>{t('Поиск напрямую в Modrinth. Установка — в выбранную сборку.')}</p></div>
        <label className="ml-search"><Icon id="i-search" /><input value={query} onChange={(e) => useMods.getState().set({ mq: e.target.value })} placeholder={t('Найти мод…')} aria-label={t('Поиск по Modrinth')} /></label>
      </header>
      <div className="ml-mod-toolbar">
        <div className="ml-mod-tabs">{TABS.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => pickTab(item.id)}>{t(item.label)}</button>)}</div>
        <label className="ml-mod-build"><span>{t('Установить в')}</span><select value={targetBuild || selected || ''} onChange={(e) => pickBuild(e.target.value)}><option value="">{t('Выбрать сборку при установке')}</option>{profiles.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.version}</option>)}</select></label>
      </div>
      {count ? <p className="ml-mod-count">{count}</p> : null}
      {hits.length ? <div className="ml-mod-list">{hits.map((hit) => {
        const id = hit.pid || hit.slug || hit.title
        return <article className="ml-mod-row" key={id}>
          <span className="ml-mod-icon">{hit.icon ? <img src={hit.icon} alt="" loading="lazy" /> : <Icon id="i-blocks" />}</span>
          <span className="ml-mod-copy"><b>{hit.title}</b><small>{t('Автор: {name}', { name: hit.author || 'Modrinth' })} · {hit.dl.toLocaleString()} {t('загрузок')}</small><span>{hit.desc}</span></span>
          <button className="ml-action-primary" disabled={!profiles.length || !!busy} onClick={() => void install(hit)}><Icon id="i-plus" />{busy === id ? t('Установка…') : t('Добавить')}</button>
        </article>
      })}</div> : <div className="ml-empty-state"><span><Icon id="i-blocks" /></span><div><b>{notice || t('Загружаем каталог Modrinth…')}</b><p>{profiles.length ? t('Выбери материал и добавь его в одну из своих сборок.') : t('Сначала создай или импортируй сборку Minecraft.')}</p></div></div>}
      {more ? <button className="ml-action-secondary ml-more-button" onClick={() => void useMods.getState().load(true)}>{t('Показать ещё')}</button> : null}
      <p className="ml-local-note">{t('Каталог загружается напрямую из Modrinth. Установка выполняется в выбранную сборку.')}</p>
    </section>
  )
}
