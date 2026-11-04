import { getCurrent, onOpenUrl } from '@tauri-apps/plugin-deep-link'
import { hasTauri } from '../ipc/tauri'
import { shortcutTrusted } from '../ipc/commands'
import { setScreen, showToast, openModal } from '../state/ui'
import { uiConfirm } from '../state/confirm'
import { useProfiles } from '../state/profiles'
import { setNewBuildPreset } from '../state/newBuild'
import { rememberServerName } from '../state/playStats'
import { quickJoin } from './joinServer'
import { joinWithAuth, realLaunch, showLaunchError } from './launch'
import { restoreLauncher } from './window'
import { t } from '../i18n'

function handle(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return
  }
  if (url.protocol !== 'minimal:') return
  restoreLauncher()
  // For minimal://join/<host> the host lands in `hostname`, the rest in `pathname`.
  const action = url.hostname || url.pathname.replace(/^\/+/, '').split('/')[0] || ''
  const rest = url.pathname.replace(/^\/+/, '')
  const q = url.searchParams

  if (action === 'join') {
    const addr = rest || q.get('addr') || ''
    if (!addr) return
    const name = q.get('name') || addr
    // The address is shown separately from the optional display name because a link can supply a misleading name.
    const label = name === addr ? `«${addr}»` : `«${name}» (${addr})`
    void uiConfirm(t('Запустить игру и зайти на сервер {server}?', { server: label }), {
      title: 'Minimal Launcher',
      confirmLabel: t('Запустить'),
      danger: false,
    }).then((ok) => {
      if (!ok) return
      rememberServerName(addr, name)
      void quickJoin(addr, name, q.get('licensed') === '1', q.getAll('version')).catch((error) =>
        showToast(t('Не удалось подключиться: {error}', { error: String(error) }), 'error'),
      )
    })
    return
  }

  if (action === 'server') {
    setScreen('servers')
    return
  }

  if (action === 'play') {
    const profile = decodeURIComponent(rest || q.get('build') || '')
    if (!useProfiles.getState().profiles.some((profileRow) => profileRow.name === profile)) {
      showToast(t('Сборки «{name}» нет в лаунчере', { name: profile }), 'error')
      setScreen('builds')
      return
    }
    void uiConfirm(t('Запустить сборку «{name}»?', { name: profile }), {
      title: 'Minimal Launcher',
      confirmLabel: t('Запустить'),
      danger: false,
    }).then((ok) => { if (ok) void realLaunch(profile) })
    return
  }

  if (action === 'launch') {
    void launchFromShortcut(q.get('profile') || '', q.get('quickplay'), q.get('key') || '')
    return
  }

  if (action === 'build') {
    setNewBuildPreset({
      version: q.get('version') || undefined,
      loader: q.get('loader') || undefined,
      name: q.get('name') || undefined,
    })
    setScreen('builds')
    openModal('nbModal')
    return
  }

  if (action === 'project') {
    // Project pages are opened inside the direct Modrinth catalogue screen.
    const slug = rest || q.get('slug') || ''
    if (!slug) return
    setScreen('mods')
    void import('../state/project').then(({ openProject }) => {
      void openProject(slug, q.get('type') === 'modpack' ? 'modpack' : 'mod')
    }).catch((error) => showToast(String(error), 'error'))
    return
  }

  if (action === 'friends') {
    setScreen('friends')
    return
  }

  // Legacy web catalog, cloud builds, chat, calls, parties and remote hosting
  // need their own server. Do not silently contact the retired service.
  if (['hosting', 'install', 'pack', 'modpack', 'open', 'game', 'skins', 'rubies', 'top', 'chat', 'call', 'party', 'invite'].includes(action)) {
    showToast(t('Эта онлайн-функция пока не подключена в Minimal Launcher'), 'error')
    setScreen('play')
  }
}

export function initDeepLinks() {
  if (!hasTauri()) return
  void getCurrent()
    .then((urls) => (urls || []).forEach(handle))
    .catch(() => {})
  void onOpenUrl((urls) => urls.forEach(handle)).catch(() => {})
}

/// minimal://launch?profile=…&quickplay=world:<folder>|server:<addr>&key=…
/// The key proves a shortcut was made on this computer; without it, ask first.
async function launchFromShortcut(profile: string, quickplay: string | null, key: string): Promise<void> {
  if (!useProfiles.getState().profiles.some((p) => p.name === profile)) {
    showToast(t('Сборки «{name}» нет в лаунчере', { name: profile }), 'error')
    setScreen('builds')
    return
  }
  const world = quickplay && quickplay.startsWith('world:') ? quickplay.slice(6) : null
  const server = quickplay && quickplay.startsWith('server:') ? quickplay.slice(7) : null
  const trusted = !!key && (await shortcutTrusted(key, profile, quickplay).catch(() => false))
  if (!trusted) {
    const what = world ? t('мир «{name}»', { name: world }) : server ? t('сервер {addr}', { addr: server }) : null
    const ok = await uiConfirm(
      what
        ? t('Запустить сборку «{name}» и зайти в {target}?', { name: profile, target: what })
        : t('Запустить сборку «{name}»?', { name: profile }),
      { title: 'Minimal Launcher', confirmLabel: t('Запустить'), danger: false },
    )
    if (!ok) return
  }
  if (world || server) {
    void joinWithAuth(profile, world, server, server).catch((error) => showLaunchError(error))
  } else {
    void realLaunch(profile)
  }
}
