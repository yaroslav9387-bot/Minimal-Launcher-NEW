import { useEffect, useRef, useState } from 'react'
import { getAccount } from '../state/accounts'
import { useUi } from '../state/ui'
import '../styles/pixel/welcome.css'
import { useT } from '../i18n'

const SEEN_KEY = 'm-welcomed'
const HOLD_MS = 1700
const CELL = 36
const DISSOLVE_MS = 560
const FLASH_MS = 70

let shownThisRun = false

function firstEver(): boolean {
  try {
    const seen = localStorage.getItem(SEEN_KEY)
    localStorage.setItem(SEEN_KEY, '1')
    return !seen
  } catch {
    return false
  }
}

export function Welcome() {
  const t = useT()
  const logged = useUi((s) => s.logged)
  const [phase, setPhase] = useState<'off' | 'in' | 'out'>('off')
  const [first, setFirst] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!logged || shownThisRun) return

    shownThisRun = true
    const isFirst = firstEver() || new URLSearchParams(location.search).get('welcome') === 'first'
    setFirst(isFirst)
    setPhase('in')
  }, [logged])

  useEffect(() => {
    if (phase !== 'in') return

    let hold: ReturnType<typeof setTimeout>
    let poll: ReturnType<typeof setTimeout>

    const start = () => {
      if (document.getElementById('boot')) {
        poll = setTimeout(start, 80)
        return
      }

      hold = setTimeout(() => setPhase('out'), HOLD_MS)
    }

    start()

    return () => {
      clearTimeout(hold)
      clearTimeout(poll)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'out') return

    const cv = canvas.current
    const ctx = cv?.getContext('2d')

    if (!cv || !ctx || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPhase('off')
      return
    }

    const dpr = window.devicePixelRatio || 1
    const w = cv.clientWidth
    const h = cv.clientHeight

    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    ctx.scale(dpr, dpr)

    const cols = Math.ceil(w / CELL)
    const rows = Math.ceil(h / CELL)
    const cx = w / 2
    const cy = h / 2
    const order: number[] = []
    let max = 0

    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const d = Math.hypot((x + 0.5) * CELL - cx, (y + 0.5) * CELL - cy) * 0.72 + Math.random() * CELL * 3
        order.push(d)
        if (d > max) max = d
      }

    const t0 = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const t = now - t0
      ctx.clearRect(0, 0, w, h)

      let left = 0

      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const at = (order[y * cols + x] / max) * DISSOLVE_MS
          if (t >= at + FLASH_MS) continue

          left++
          ctx.fillStyle = t >= at ? '#3fbf5c' : '#155f2a'
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
        }

      if (left) raf = requestAnimationFrame(tick)
      else setPhase('off')
    }

    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [phase])

  if (phase === 'off') return null

  const acc = getAccount()
  const nick = acc?.nick || ''

  return (
    <div className={'welcome is-' + phase} onClick={() => setPhase('out')} role="presentation">
      <canvas ref={canvas} className="welcome-cells" aria-hidden="true" />
      <div className="welcome-body" aria-live="polite">
        <img className="welcome-logo" src="/minimal-logo.svg" alt="" />
        <span className="welcome-hi">{first ? t('Добро пожаловать') : t('С возвращением,')}</span>
        <b className="welcome-nick">{first ? 'Minimal Launcher' : nick || t('игрок')}</b>
      </div>
    </div>
  )
}
