import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../Icon'
import { PxIcon } from '../PxIcon'
import type { ModFile, PlanItem, Profile } from '../../ipc/commands'
import { installDepItems } from '../../ipc/commands'
import { hasTauri } from '../../ipc/tauri'
import { LOADER_NAME, loaderId } from '../../lib/format'
import { renderMarkdown } from '../../lib/markdown'
import { tidyBody } from '../../modals/projectView'
import { showToast } from '../../state/ui'
import { DEMO_USER } from '../../lib/demo'
import '../../styles/pixel/moddl.css'
import { t, tx, useT } from '../../i18n'

/*
 * Build-scoped Modrinth installer. Searches and version metadata are fetched
 * directly from Modrinth; selected files are installed by the native core.
 */

type Source = 'modrinth'
/** pids — IDs Modrinth projects already recorded in the selected build. */
type Hit = { id: string; slug: string; title: string; author: string; desc: string; icon: string | null; downloads: number; pids: string[] }
/** deps — Modrinth id обязательных зависимостей; reqs — обязательные из нашего каталога (slug). */
type Ver = { id: string; name: string; file: string; deps: string[]; date: string; type: string; pid?: string; sha1?: string | null; reqs?: { slug: string; title: string }[] }
type Queued = { source: Source; id: string; slug: string; title: string; icon: string | null; ver: Ver }
type Fit = { ver: boolean; loader: boolean }
type Dep = { source: Source; id: string; title: string; icon: string | null; ver: Ver | null; by: string; on: boolean }

const MR = 'https://api.modrinth.com/v2'
const PT: Record<string, string> = { mod: 'mod', resourcepack: 'resourcepack', shader: 'shader', datapack: 'datapack' }
const KIND_TITLE: Record<string, string> = {
  get mod() {
    return t('моды')
  },
  get resourcepack() {
    return t('ресурс-паки')
  },
  get shader() {
    return t('шейдеры')
  },
  get datapack() {
    return t('дата-паки')
  },
}
const sorts = (): [string, string][] => [
  ['relevance', t('Релевантность')],
  ['downloads', t('Скачивания')],
  ['follows', t('Подписчики')],
  ['newest', t('Новые')],
  ['updated', t('Обновлённые')],
]

const TYPE_RU: Record<string, string> = {
  get release() {
    return t('релиз')
  },
  get beta() {
    return t('бета')
  },
  get alpha() {
    return t('альфа')
  },
}
const norm = (t: string) => t.toLowerCase().replace(/[^a-zа-я0-9]+/g, '')
const fmt = (n: number) => (n >= 1e6 ? t('{n} млн', { n: (n / 1e6).toFixed(1).replace('.0', '') }) : n >= 1e3 ? t('{n} тыс.', { n: Math.round(n / 1e3) }) : String(n))

async function mrSearch(q: string, kind: string, build: Profile, fit: Fit, sort: string, offset: number): Promise<{ hits: Hit[]; total: number }> {
  const facets: string[][] = [kind === 'datapack' ? ['categories:datapack'] : ['project_type:' + PT[kind]]]
  if (fit.ver) facets.push(['versions:' + build.version])
  if (fit.loader && kind === 'mod') facets.push(['categories:' + loaderId(build)])
  const u = MR + '/search?limit=30&offset=' + offset + '&index=' + sort + '&query=' + encodeURIComponent(q) + '&facets=' + encodeURIComponent(JSON.stringify(facets))
  const r = await fetch(u)
  if (!r.ok) throw new Error('Modrinth ' + r.status)
  const j = (await r.json()) as { hits: { project_id: string; slug: string; title: string; author: string; description: string; icon_url: string | null; downloads: number }[]; total_hits: number }
  return {
    total: j.total_hits,
    hits: j.hits.map((h) => ({ id: h.project_id, slug: h.slug, title: h.title, author: h.author, desc: h.description, icon: h.icon_url || null, downloads: h.downloads, pids: [h.project_id] })),
  }
}

async function mrVersions(id: string, kind: string, build: Profile, fit: Fit): Promise<Ver[]> {
  const ps = [fit.ver ? 'game_versions=' + encodeURIComponent(JSON.stringify([build.version])) : '', fit.loader && kind === 'mod' ? 'loaders=' + encodeURIComponent(JSON.stringify([loaderId(build)])) : ''].filter(Boolean)
  const q = ps.length ? '?' + ps.join('&') : ''
  const r = await fetch(MR + '/project/' + id + '/version' + q)
  if (!r.ok) return []
  const list = (await r.json()) as {
    id: string
    project_id: string
    version_number: string
    name: string
    date_published: string
    version_type: string
    files: { filename: string; primary: boolean }[]
    dependencies: { project_id: string | null; dependency_type: string }[]
  }[]
  return list.map((v) => ({
    id: v.id,
    name: v.version_number,
    file: (v.files.find((f) => f.primary) || v.files[0])?.filename || '',
    deps: v.dependencies.filter((d) => d.dependency_type === 'required' && d.project_id).map((d) => d.project_id!),
    date: v.date_published,
    type: v.version_type,
    pid: v.project_id,
  }))
}

export function ModDownloader({
  build,
  kind,
  installed,
  onClose,
  onDone,
  onRemove,
}: {
  build: Profile
  kind: string
  installed: ModFile[]
  onClose: () => void
  /** «Удалить из сборки» вместо «Уже в сборке»: файл этой вещи в сборке. */
  onRemove: (file: string) => Promise<void>
  /** Поставили — список сборки перечитать. demo — что изобразить в браузере. */
  onDone: (demo?: ModFile[]) => void
}) {
  const t = useT()
  const source: Source = 'modrinth'
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('relevance')
  const [fit, setFit] = useState<Fit>({ ver: true, loader: true })
  const [hideHave, setHideHave] = useState(false)
  const [filters, setFilters] = useState(false)
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [total, setTotal] = useState(0)
  const [err, setErr] = useState('')
  const [cur, setCur] = useState<Hit | null>(null)
  const [body, setBody] = useState<string | null>(null)
  const [vers, setVers] = useState<Ver[] | null>(null)
  const [verId, setVerId] = useState('')
  const [queue, setQueue] = useState<Map<string, Queued>>(new Map())
  const [review, setReview] = useState<Dep[] | null>(null)
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const have = useMemo(() => new Set(installed.map((m) => m.project_id).filter(Boolean) as string[]), [installed])
  // Вещь из каталога и та же вещь, поставленная с Modrinth, — разные id; совпадение по имени тоже «в сборке».
  const haveTitle = useMemo(() => new Set(installed.map((m) => norm(m.title || ''))), [installed])
  const qkey = (h: { id: string }) => source + ':' + h.id
  const inBuild = (h: Hit) => h.pids.some((p) => have.has(p)) || have.has(h.id) || haveTitle.has(norm(h.title))

  const load = (offset = 0) => {
    const my = ++seq.current
    setErr('')
    if (!offset) setHits(null)
    mrSearch(q.trim(), kind, build, fit, sort, offset)
      .then((r) => {
        if (my !== seq.current) return
        setTotal(r.total)
        setHits((h) => {
          // Страницы выдачи могут пересекаться — без дублей.
          const all = offset && h ? [...h, ...r.hits] : r.hits
          const seen = new Set<string>()
          return all.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
        })
        if (!offset && listRef.current) listRef.current.scrollTop = 0
      })
      .catch((e) => my === seq.current && (setHits([]), setErr(tx(e))))
  }
  useEffect(() => {
    const t = window.setTimeout(() => load(0), q ? 280 : 0)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, fit.ver, fit.loader, source])

  // Выбранный проект: описание и версии под сборку.
  useEffect(() => {
    setBody(null)
    setVers(null)
    setVerId('')
    if (!cur) return
    let live = true
    void fetch(MR + '/project/' + cur.id)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: { body?: string } | null) => live && setBody(p?.body || cur.desc))
      .catch(() => live && setBody(cur.desc))
    void mrVersions(cur.id, kind, build, fit)
      .then((v) => {
        if (!live) return
        setVers(v)
        setVerId(queue.get(qkey(cur))?.ver.id || v[0]?.id || '')
      })
      .catch(() => live && setVers([]))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.id, source, fit.ver, fit.loader])

  const queued = cur ? queue.has(qkey(cur)) : false
  const toggleQueue = () => {
    if (!cur) return
    const k = qkey(cur)
    const next = new Map(queue)
    if (next.has(k)) next.delete(k)
    else {
      const ver = vers?.find((v) => v.id === verId)
      if (!ver) return
      // Та же вещь с другой площадки — заменяет прежний выбор, а не встаёт второй раз.
      for (const [key, x] of next) if (norm(x.title) === norm(cur.title)) next.delete(key)
      next.set(k, { source, id: cur.id, slug: cur.slug, title: cur.title, icon: cur.icon, ver })
    }
    setQueue(next)
  }

  /* «Проверить и подтвердить»: зависимости Modrinth, которых нет ни в сборке, ни в очереди. */
  const openReview = async () => {
    setBusy(true)
    const inQueue = new Set([...queue.values()].map((x) => x.id))
    const need = new Map<string, string>()
    for (const x of queue.values()) for (const d of x.ver.deps) if (!have.has(d) && !inQueue.has(d) && !need.has(d)) need.set(d, x.title)
    let deps: Dep[] = []
    if (need.size) {
      try {
        const r = await fetch(MR + '/projects?ids=' + encodeURIComponent(JSON.stringify([...need.keys()])))
        const list = r.ok ? ((await r.json()) as { id: string; title: string; icon_url: string | null }[]) : []
        deps = await Promise.all(
          list.map(async (p) => {
            const versions = await mrVersions(p.id, 'mod', build, { ver: true, loader: true }).catch(() => [])
            return { source: 'modrinth' as Source, id: p.id, title: p.title, icon: p.icon_url, ver: versions[0] || null, by: need.get(p.id) || '', on: !!versions[0] }
          }),
        )
      } catch {
        /* If Modrinth's dependency endpoint is unavailable, install the selected projects. */
      }
    }
    setBusy(false)
    const seenDep = new Set<string>()
    setReview(deps.filter((d) => (seenDep.has(d.source + d.id) ? false : (seenDep.add(d.source + d.id), true))))
  }

  const confirm = async () => {
    if (!review) return
    const picks = [...queue.values()]
    const deps = review.filter((d) => d.on && d.ver)
    if (!hasTauri()) {
      if (!DEMO_USER) {
        showToast(t('Установка доступна в приложении'))
        return
      }
      onDone(
        [
          ...picks.map((x) => ({ t: x.title, ic: x.icon, v: x.ver, id: x.ver.pid || x.id })),
          ...deps.map((d) => ({ t: d.title, ic: d.icon, v: d.ver!, id: d.ver?.pid || d.id })),
        ].map((x) => ({
          name: x.v.file || x.t + '.jar',
          enabled: true,
          project_id: x.id,
          version_number: x.v.name,
          title: x.t,
          icon_url: x.ic || undefined,
          size: 0,
          scanned: true,
        })),
      )
      showToast(t('Поставлено: {n}', { n: picks.length + deps.length }), 'ok')
      onClose()
      return
    }
    setBusy(true)
    try {
      const mr: PlanItem[] = [
        ...picks.map((x) => ({ source: 'modrinth', project_id: x.id, version_id: x.ver.id })),
        ...deps.map((d) => ({ source: 'modrinth', project_id: d.id, version_id: d.ver!.id })),
      ]
      const result = await installDepItems(build.name, kind, mr)
      const failed = result.failed
      if (failed.length) showToast(t('Не встало: {list}', { list: failed.join('; ') }), 'error')
      else showToast(t('Поставлено: {n}', { n: picks.length + deps.length }), 'ok', 'install')
      onDone()
      onClose()
    } catch (e) {
      showToast('' + e, 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // Перехват до общего Esc окна сборки (App.tsx): иначе Esc закрывал страницу сборки целиком.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      if (review) setReview(null)
      else onClose()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [review, onClose])

  // «[![картинка](src)](ссылка)» — баннер-ссылка: парсер описаний её не знает, оставляем картинку.
  const md = useMemo(() => (body ? renderMarkdown(tidyBody(body.replace(/\[(!\[[^\]]*\]\([^)]*\))\]\([^)]*\)/g, '$1'))) : null), [body])
  const kt = KIND_TITLE[kind] || t('моды')

  return createPortal(
    <div className="mdl-back" role="dialog" aria-modal="true" aria-label={t('Добавить {kind}', { kind: kt })}>
      <div className="card mdl">
        <div className="mdl-top">
          <b className="mdl-title">
            {t('Добавить {kind}', { kind: kt })} <span>{t('в «{name}»', { name: build.name })}</span>
          </b>
          <span className="mdl-for">{[build.version, kind === 'mod' ? LOADER_NAME(build) : ''].filter(Boolean).join(' · ')}</span>
          <button type="button" className="btn sm ghost mdl-x" aria-label={t('Закрыть')} onClick={onClose}>
            <Icon id="i-x" />
          </button>
        </div>

        <div className="mdl-grid">
          <nav className="mdl-src" aria-label={t('Источник')}>
            <button type="button" className="mdl-src-btn on" aria-current="page">
              <img src="https://modrinth.com/favicon.ico" alt="" />
              <span>Modrinth</span>
            </button>
          </nav>

          <div className="mdl-mid">
            <div className="mdl-bar">
              <div className="input sm mdl-search">
                <Icon id="i-search" />
                <input autoFocus placeholder={t('Поиск')} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <select className="m-select-btn mdl-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={t('Сортировка')}>
                {sorts().map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <button type="button" className={'btn sm ' + (filters ? 'primary' : 'secondary')} aria-expanded={filters} onClick={() => setFilters((v) => !v)}>
                <Icon id="i-filter" />
                {t('Фильтр')}
                {(fit.ver ? 1 : 0) + (fit.loader && kind === 'mod' ? 1 : 0) + (hideHave ? 1 : 0) ? <span className="nav-count">{(fit.ver ? 1 : 0) + (fit.loader && kind === 'mod' ? 1 : 0) + (hideHave ? 1 : 0)}</span> : null}
              </button>
            </div>
            {filters ? (
              <div className="mdl-filters">
                <label className="mdl-fl">
                  <span className={'chk' + (fit.ver ? ' on' : '')} role="checkbox" aria-checked={fit.ver} onClick={() => setFit((f) => ({ ...f, ver: !f.ver }))} />
                  {t('Только версия {version}', { version: build.version })}
                </label>
                {kind === 'mod' ? (
                  <label className="mdl-fl">
                    <span className={'chk' + (fit.loader ? ' on' : '')} role="checkbox" aria-checked={fit.loader} onClick={() => setFit((f) => ({ ...f, loader: !f.loader }))} />
                    {t('Только {loader}', { loader: LOADER_NAME(build) })}
                  </label>
                ) : null}
                <label className="mdl-fl">
                  <span className={'chk' + (hideHave ? ' on' : '')} role="checkbox" aria-checked={hideHave} onClick={() => setHideHave((v) => !v)} />
                  {t('Скрыть то, что уже в сборке')}
                </label>
              </div>
            ) : null}
            <div className="mdl-list" ref={listRef} onScroll={(e) => {
              const el = e.currentTarget
              if (hits && hits.length < total && el.scrollTop + el.clientHeight > el.scrollHeight - 200 && seq.current) load(hits.length)
            }}>
              {hits === null ? (
                Array.from({ length: 8 }, (_, i) => <span key={i} className="skel mdl-skel" />)
              ) : err && !hits.length ? (
                <p className="mdl-note">{err}</p>
              ) : !hits.length ? (
                <p className="mdl-note">{t('Ничего не нашлось')}</p>
              ) : (
                hits.filter((h) => !(hideHave && inBuild(h))).map((h) => {
                  const inQ = queue.has(qkey(h))
                  const inB = inBuild(h)
                  return (
                    <button
                      key={h.id}
                      type="button"
                      className={'mdl-row' + (cur?.id === h.id ? ' cur' : '') + (inQ ? ' queued' : '') + (inB ? ' have' : '')}
                      onClick={() => setCur(h)}
                    >
                      <span className="mdl-ic">{h.icon ? <img src={h.icon} alt="" loading="lazy" /> : <PxIcon name="box" size={24} />}</span>
                      <span className="mdl-txt">
                        <b>
                          {h.title}
                          {h.author ? <i>{h.author}</i> : null}
                        </b>
                        <span>{h.desc}</span>
                      </span>
                      {inB ? <span className="mdl-tag">{t('В сборке')}</span> : inQ ? <Icon id="i-check" className="icon mdl-qmark" /> : <span className="mdl-dl">{fmt(h.downloads)}</span>}
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="mdl-info">
            {cur ? (
              <>
                <div className="mdl-info-head">
                  <span className="mdl-ic lg">{cur.icon ? <img src={cur.icon} alt="" /> : <PxIcon name="box" size={30} />}</span>
                  <span className="mdl-txt">
                    <b>{cur.title}</b>
                    <span>{cur.author}</span>
                  </span>
                </div>
                <div className="mdl-body pj-body">{md || <span className="skel mdl-skel" />}</div>
                <div className="mdl-pick">
                  <select
                    className="m-select-btn mdl-ver"
                    value={verId}
                    disabled={!vers || !vers.length || queued || inBuild(cur)}
                    onChange={(e) => setVerId(e.target.value)}
                    aria-label={t('Версия')}
                  >
                    {!vers ? <option>{t('Загружаем версии')}</option> : !vers.length ? <option>{t('Нет версии под {version}', { version: build.version })}</option> : null}
                    {(vers || []).map((v, i) => (
                      <option key={v.id} value={v.id}>
                        {v.name + (i === 0 ? ' ' + t('(рекомендуется)') : v.type !== 'release' ? ' · ' + v.type : '')}
                      </option>
                    ))}
                  </select>
                  {inBuild(cur) ? (
                    <button
                      type="button"
                      className="btn md danger"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true)
                        const f = installed.find((m) => (m.project_id && (cur.pids.includes(m.project_id) || m.project_id === cur.id)) || norm(m.title || '') === norm(cur.title))
                        void (f ? onRemove(f.name) : Promise.resolve()).finally(() => setBusy(false))
                      }}
                    >
                      <Icon id="i-trash" /> {t('Удалить из сборки')}
                    </button>
                  ) : (
                    <button type="button" className={'btn md ' + (queued ? 'secondary' : 'primary')} disabled={!queued && !verId} onClick={toggleQueue}>
                      {queued ? t('Убрать из списка') : t('Выбрать')}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="mdl-info-empty">
                <PxIcon name="blocks" size={44} />
              </div>
            )}
          </div>
        </div>

        <div className="mdl-foot">
          <span className="mdl-queue">
            {[...queue.values()].slice(0, 8).map((x) => (
              <span key={x.source + x.id} className="mdl-chip" title={x.title}>
                {x.icon ? <img src={x.icon} alt="" /> : null}
                {x.title}
              </span>
            ))}
            {queue.size > 8 ? <span className="mdl-chip">+{queue.size - 8}</span> : null}
          </span>
          <button type="button" className="btn md secondary" onClick={onClose}>
            {t('Отмена')}
          </button>
          <button type="button" className="btn md primary" disabled={!queue.size || busy} onClick={() => void openReview()}>
            {busy && !review ? <span className="spin" aria-hidden="true" /> : null}
            {t('Добавить в сборку')}{queue.size ? ' (' + queue.size + ')' : ''}
          </button>
        </div>

        {review ? (
          <div className="mdl-review-back">
            <div className="card mdl-review">
              <b className="mdl-title">{t('Добавить в «{name}»?', { name: build.name })}</b>
              <ul className="mdl-rv-list">
                {[...queue.values()].map((x) => (
                  <li key={x.source + x.id} className="mdl-rv-row">
                    <span className="chk on" aria-hidden="true" />
                    <span className="mdl-ic">{x.icon ? <img src={x.icon} alt="" /> : <PxIcon name="box" size={20} />}</span>
                    <span className="mdl-txt">
                      <b>{x.title}</b>
                      <span>{[x.ver.file || x.ver.name, 'Modrinth', TYPE_RU[x.ver.type] || x.ver.type].join(' · ')}</span>
                    </span>
                  </li>
                ))}
                {review.map((d) => (
                  <li key={d.id} className={'mdl-rv-row dep' + (d.ver ? '' : ' none')}>
                    <span
                      className={'chk' + (d.on ? ' on' : '')}
                      role="checkbox"
                      aria-checked={d.on}
                      onClick={() => d.ver && setReview(review.map((x) => (x.id === d.id ? { ...x, on: !x.on } : x)))}
                    />
                    <span className="mdl-ic">{d.icon ? <img src={d.icon} alt="" /> : <PxIcon name="box" size={20} />}</span>
                    <span className="mdl-txt">
                      <b>{d.title}</b>
                      <span>{d.ver ? t('Нужен для: {name}', { name: d.by }) + ' · ' + (d.ver.file || d.ver.name) : t('нет версии под {version}', { version: build.version })}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mdl-rv-foot">
                {review.some((d) => d.ver) ? (
                  <button
                    type="button"
                    className="btn md ghost mdl-rv-deps"
                    onClick={() => {
                      const on = !review.every((d) => !d.ver || d.on)
                      setReview(review.map((d) => (d.ver ? { ...d, on } : d)))
                    }}
                  >
                    {review.every((d) => !d.ver || d.on) ? t('Зависимости: вкл') : t('Зависимости: выкл')}
                  </button>
                ) : null}
                <button type="button" className="btn md secondary" onClick={() => setReview(null)}>
                  {t('Назад')}
                </button>
                <button type="button" className="btn md primary" disabled={busy} onClick={() => void confirm()}>
                  {busy ? <span className="spin" aria-hidden="true" /> : null}
                  {t('Добавить')}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
