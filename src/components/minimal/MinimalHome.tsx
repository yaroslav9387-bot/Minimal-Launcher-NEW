import { useMemo, useState } from 'react'
import { Icon } from '../Icon'
import { BuildIcon } from '../playhub/BuildIcon'
import { useProfiles } from '../../state/profiles'
import { useLobby } from '../../state/lobbyMode'
import { useGame, stopRunningGame } from '../../state/game'
import { useUi, showToast } from '../../state/ui'
import { openBuildSettings } from '../../state/instance'
import { realLaunch, cancelPrelaunch } from '../../lib/launch'
import { hasTauri } from '../../ipc/tauri'
import { useT } from '../../i18n'
import type { ScreenId } from '../../state/ui'

export function MinimalHome({ onNav }: { onNav: (screen: ScreenId) => void }) {
  const t = useT()
  const profiles = useProfiles((s) => s.profiles)
  const selected = useProfiles((s) => s.selected)
  const setSelected = useProfiles((s) => s.setSelected)
  const running = useGame((s) => s.list)
  const stopping = useGame((s) => s.stopping)
  const prelaunch = useUi((s) => s.prelaunch)
  const [query, setQuery] = useState('')
  const selectedProfile = profiles.find((p) => p.name === selected) || profiles[0] || null
  const filteredProfiles = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    return q ? profiles.filter((p) => p.name.toLocaleLowerCase().includes(q) || p.version.toLocaleLowerCase().includes(q)) : profiles
  }, [profiles, query])
  const isRunning = !!selectedProfile && running.includes(selectedProfile.name)

  const chooseProfile = (name: string) => {
    setSelected(name)
    useLobby.getState().pick({ kind: 'build', name })
  }

  const play = () => {
    if (!hasTauri()) {
      showToast(t('Запуск Minecraft доступен в установленном приложении'), 'error')
      return
    }
    if (prelaunch.open) {
      cancelPrelaunch()
      return
    }
    if (!selectedProfile) {
      useUi.getState().openModal('nbModal')
      return
    }
    chooseProfile(selectedProfile.name)
    void realLaunch(selectedProfile.name)
  }

  const newBuild = () => useUi.getState().openModal('nbModal')
  const importBuild = () => useUi.getState().openModal('impModal')

  return (
    <section className="ml-home screen on" id="s-home">
      <header className="ml-home-header">
        <div>
          <div className="ml-eyebrow">MINECRAFT LAUNCHER</div>
          <h1>{t('Главная')}</h1>
        </div>
        <div className="ml-home-actions">
          <label className="ml-search">
            <Icon id="i-search" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Поиск сборок…')} aria-label={t('Поиск сборок')} />
          </label>
          <button className="ml-action-secondary" onClick={() => onNav('mods')}>
            <Icon id="i-blocks" /> {t('Скачать моды')}
          </button>
          <button className="ml-action-primary" onClick={newBuild}>
            <Icon id="i-plus" /> {t('Новая сборка')}
          </button>
        </div>
      </header>

      <div className="ml-hero">
        <div className="ml-hero-copy">
          <div className="ml-hero-kicker"><span /> {t('ВАША ИГРА — ВАШИ ПРАВИЛА')}</div>
          <h2>{t('Время играть.')}<br /><span>{t('Без лишнего.')}</span></h2>
          <p>{t('Все ваши сборки Minecraft — в одном удобном месте.')}</p>
          <div className="ml-hero-controls">
            {selectedProfile ? (
              <select
                value={selectedProfile.name}
                onChange={(e) => chooseProfile(e.target.value)}
                aria-label={t('Выбрать сборку для запуска')}
              >
                {profiles.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.version}</option>)}
              </select>
            ) : (
              <span className="ml-no-profile">{t('Сначала создайте свою первую сборку')}</span>
            )}
            <button className="ml-play-button" onClick={isRunning ? () => void stopRunningGame(selectedProfile!.name) : play} disabled={stopping}>
              <Icon id={isRunning ? 'i-power' : prelaunch.open ? 'i-x' : 'i-play'} />
              {stopping ? t('Останавливаем…') : isRunning ? t('Остановить') : prelaunch.open ? t('Отменить запуск') : selectedProfile ? t('Играть') : t('Создать сборку')}
            </button>
          </div>
        </div>
        <div className="ml-hero-art" aria-hidden="true">
          <img src="/branding/minecraft-background.png" alt="" />
          <div className="ml-hero-stamp">MINIMAL<br /><b>LAUNCHER</b></div>
        </div>
      </div>

      <section className="ml-section">
        <div className="ml-section-heading">
          <div><h2>{t('Быстрый доступ')}</h2><p>{t('Часто используемые действия')}</p></div>
        </div>
        <div className="ml-quick-grid">
          <button className="ml-quick-card" onClick={newBuild}><span className="ml-quick-icon"><Icon id="i-plus" /></span><b>{t('Новая сборка')}</b><small>{t('Установить Minecraft')}</small></button>
          <button className="ml-quick-card" onClick={importBuild}><span className="ml-quick-icon"><Icon id="i-download" /></span><b>{t('Импорт')}</b><small>{t('Добавить готовую сборку')}</small></button>
          <button className="ml-quick-card" onClick={() => onNav('mods')}><span className="ml-quick-icon"><Icon id="i-blocks" /></span><b>{t('Найти моды')}</b><small>{t('Открыть каталог модов')}</small></button>
          <button className="ml-quick-card" onClick={() => onNav('friends')}><span className="ml-quick-icon"><Icon id="i-users" /></span><b>{t('Друзья')}</b><small>{t('Локальный список ников')}</small></button>
        </div>
      </section>

      <section className="ml-section ml-recent-section">
        <div className="ml-section-heading">
          <div><h2>{t('Недавно запускали')}</h2><p>{t('Ваши игровые профили')}</p></div>
          <button className="ml-text-link" onClick={() => onNav('builds')}>{t('Вся библиотека')} <Icon id="i-arrow-r" /></button>
        </div>
        {filteredProfiles.length ? (
          <div className="ml-profile-grid">
            {filteredProfiles.slice(0, 4).map((profile) => (
              <button
                key={profile.name}
                className={'ml-profile-card' + (selectedProfile?.name === profile.name ? ' selected' : '')}
                onClick={() => openBuildSettings(profile.name)}
                onContextMenu={(e) => { e.preventDefault(); chooseProfile(profile.name) }}
              >
                <span className="ml-profile-icon"><BuildIcon icon={profile.icon} name={profile.name} size={46} /></span>
                <span className="ml-profile-copy"><b>{profile.name}</b><small>Minecraft {profile.version} · {(profile.loader || (profile.fabric ? 'Fabric' : 'Vanilla')).toString()}</small></span>
                <span className="ml-profile-open" aria-hidden="true"><Icon id="i-chev-r" /></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ml-empty-state">
            <span><Icon id="i-box2" /></span>
            <div><b>{query ? t('Сборки не найдены') : t('Библиотека пока пуста')}</b><p>{query ? t('Попробуйте изменить поисковый запрос.') : t('Создайте или импортируйте сборку Minecraft, чтобы начать играть.')}</p></div>
            {!query ? <button onClick={newBuild}>{t('Создать сборку')}</button> : null}
          </div>
        )}
      </section>
    </section>
  )
}
