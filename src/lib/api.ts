// Minimal Launcher is standalone: Modrinth is requested directly, while old
// Millida-only services are deliberately unavailable (no hidden fallback).
import { hasTauri } from '../ipc/tauri'
import { openUrl, type ApiMarket } from '../ipc/commands'
import { getLocale } from '../i18n'

// Relative sentinel keeps any legacy image/catalog URL local to the app and
// makes it impossible for these paths to contact the retired Millida servers.
export const LAUNCHER_API = '/__minimal_services_disabled__'
export const MODRINTH_API = 'https://api.modrinth.com'

export function mirrorAsset(url: string | undefined | null): string | undefined {
  if (!url) return undefined
  return url
}

export const PROFILE_URL = 'https://github.com/yaroslav9387-bot/Minimal-Launcher-Standalone'
export const PLUS_MANAGE_URL = 'https://github.com/yaroslav9387-bot/Minimal-Launcher-Standalone/releases'
export const SUPPORT_URL = 'https://github.com/yaroslav9387-bot/Minimal-Launcher-Standalone/issues'

export function apiHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', ...langHeaders() }
}

export function langHeaders(): Record<string, string> {
  const lang = getLocale()
  return { 'Accept-Language': lang }
}

export function marketFor(_pathname: string): ApiMarket | undefined {
  return undefined
}

/** Millida accounts and sessions are not part of the standalone launcher. */
export function hasMillidaAccount(): boolean {
  return false
}

export const SESSION_EXPIRED_EVENT = 'minimal-session-expired'

/**
 * Old social, cloud, store and hosted-server endpoints belonged to Millida.
 * Fail locally and clearly instead of silently sending requests to a third party.
 * Modrinth catalog requests use MODRINTH_API directly and do not pass through here.
 */
export async function api<T = any>(_pathname: string, _opts?: RequestInit): Promise<T> {
  throw new Error('Этот онлайн-сервис пока не подключён в Minimal Launcher.')
}

const SHARED_GET = /^\/(?:hosting|vds)\//
const inflightGets = new Map<string, Promise<unknown>>()

/**
 * Хостинг: список и карточка сервера просят одни и те же адреса из нескольких мест сразу (родной экран,
 * экран с сайта, прогрев при наведении). Пока первый запрос в пути, остальные ждут его ответ, а не шлют свой.
 */
export function sharedGet<T>(pathname: string, variant: string, run: () => Promise<T>): Promise<T> {
  if (!SHARED_GET.test(pathname)) return hedged(run)
  const key = variant + '|' + pathname
  const live = inflightGets.get(key)
  if (live) return live as Promise<T>
  const p = hedged(run).finally(() => inflightGets.delete(key))
  inflightGets.set(key, p)
  return p
}

/** Через сколько без ответа уходит второй такой же запрос. */
export const HEDGE_AFTER_MS = 6_000

/**
 * Запрос на чтение, который не зависает из-за одного зависшего соединения:
 * нет ответа за 6 с — уходит второй такой же, берём первый успешный. Щит
 * перед API (12.10.2026) подвешивал примерно каждое 6–10-е соединение на
 * 1–18 с: списки висели на скелетах, а в «Добавить моды» не появлялись версии
 * и кнопка «Выбрать» оставалась выключенной. Быстрая ошибка возвращается
 * сразу, как раньше; повторяются только GET.
 */
export function hedged<T>(run: () => Promise<T>, afterMs = HEDGE_AFTER_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false
    let pending = 0
    let timer = 0
    const start = () => {
      pending++
      run().then(
        (v) => {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve(v)
        },
        (e) => {
          pending--
          if (done || pending > 0) return
          done = true
          clearTimeout(timer)
          reject(e)
        },
      )
    }
    timer = setTimeout(() => {
      if (!done) start()
    }, afterMs) as unknown as number
    start()
  })
}

export function openExt(u: string) {
  if (hasTauri()) openUrl(u)
  else window.open(u, '_blank')
}
