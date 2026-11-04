import { useEffect, useState } from 'react'
import { PxIcon } from '../components/PxIcon'
import { LicenceBuyLink, type GameAccountKind } from '../components/AccountChoice'
import { KindPanel } from '../modals/AccountAdd'
import { LangPicker } from '../components/LangPicker'
import { useT } from '../i18n'
import { finishFirstRun } from '../state/firstRun'
import { isGameAccountKind, useAccounts } from '../state/accounts'
import { refreshGameNick } from '../state/gameNick'
import { openExt } from '../lib/api'
import { PixelField } from '../components/lobby/PixelField'
import '../styles/pixel/login.css'

const SECURITY_URL = 'https://account.microsoft.com/security'

function GameAccountStep() {
  const t = useT()
  const [kind, setKind] = useState<GameAccountKind | null>(null)
  const added = useAccounts((s) => s.list.some((a) => isGameAccountKind(a.kind)))

  useEffect(() => {
    void refreshGameNick()
  }, [])

  useEffect(() => {
    if (added) finishFirstRun()
  }, [added])

  return (
    <div className="login-form lg2-card">
      <LangPicker className="lg2-lang" />
      <div className="login-logo">
        <img src="/minimal-logo.svg" alt="" width={56} height={56} />
      </div>
      <h1>{t('Игровой аккаунт')}</h1>
      <p className="sub">{t('Выберите способ запуска Minecraft.')}</p>
      {kind ? (
        <KindPanel kind={kind} onBack={() => setKind(null)} onDone={() => undefined} onSafety={() => openExt(SECURITY_URL)} />
      ) : (
        <>
          <button className="btn lg primary lg2-main" data-track="first_run_licence" onClick={() => setKind('microsoft')}>
            <PxIcon name="mc-grass" size={24} />
            {t('Лицензия Minecraft')}
          </button>
          <button className="btn md secondary lg2-guest lg2-offline" data-track="first_run_offline" onClick={() => setKind('offline')}>
            <b>{t('Офлайн-аккаунт')}</b>
            <span>{t('Без Realms и серверов, требующих лицензию')}</span>
          </button>
          <LicenceBuyLink className="lg2-buy" track="first_run" />
          <p className="lg2-privacy">{t('Для лицензии используется официальный вход Microsoft. Пароль не передаётся лаунчеру.')}</p>
        </>
      )}
    </div>
  )
}

export function Login({ on }: { on: boolean }) {
  return (
    <div id="scr-login" className={'lg2' + (on ? ' on' : '')}>
      <PixelField on={on} />
      <div className="login-wrap lg2-wrap">
        <GameAccountStep />
        <div className="login-art lg2-art">
          <img src="/lobby/duo@2x.webp" alt="" />
          <span className="lg2-shadow" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
