import { Icon } from '../Icon'
import { useMods } from '../../state/mods'
import { showToast, useUi } from '../../state/ui'
import type { ScreenId } from '../../state/ui'
import { t, useT } from '../../i18n'

/** A small, independent navigation rail for the Minimal Launcher shell. */
export function MinimalSidebar({ onNav }: { onNav: (screen: ScreenId) => void }) {
  useT()
  const screen = useUi((s) => s.screen)

  const go = (key: string) => {
    switch (key) {
      case 'home':
        onNav('play')
        break
      case 'library':
        onNav('builds')
        break
      case 'mods':
        useMods.getState().scopeTo(null)
        onNav('mods')
        break
      case 'servers':
        onNav('servers')
        break
      case 'friends':
        onNav('friends')
        break
      case 'settings':
        onNav('settings')
        break
      default:
        showToast(t('Раздел пока не подключён'), 'error')
    }
  }

  const items = [
    { key: 'home', label: t('Главная'), icon: 'i-play', active: screen === 'play' },
    { key: 'library', label: t('Библиотека'), icon: 'i-box2', active: screen === 'builds' },
    { key: 'mods', label: t('Моды'), icon: 'i-blocks', active: screen === 'mods' },
    { key: 'servers', label: t('Серверы'), icon: 'i-server', active: screen === 'servers' },
    { key: 'friends', label: t('Друзья'), icon: 'i-users', active: screen === 'friends' },
  ]

  return (
    <aside className="ml-sidebar" aria-label={t('Главная навигация')}>
      <button className="ml-mark" onClick={() => go('home')} title="Minimal Launcher" aria-label="Minimal Launcher">
        <img src="/minimal-logo.svg" alt="" />
      </button>
      <nav className="ml-rail-nav">
        {items.map((item) => (
          <button
            key={item.key}
            className={'ml-rail-item' + (item.active ? ' active' : '')}
            onClick={() => go(item.key)}
            title={item.label}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
          >
            <Icon id={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="ml-rail-bottom">
        <button
          className={'ml-rail-item' + (screen === 'settings' ? ' active' : '')}
          onClick={() => go('settings')}
          title={t('Настройки')}
          aria-label={t('Настройки')}
          aria-current={screen === 'settings' ? 'page' : undefined}
        >
          <Icon id="i-settings" />
          <span>{t('Настройки')}</span>
        </button>
      </div>
    </aside>
  )
}
