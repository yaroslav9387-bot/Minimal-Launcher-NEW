export const NATIVE_GAME_VERSION = 'native'
export const NATIVE_LOADER = 'custom'

export const NATIVE_NEEDS_SERVICE = 'Эта сборка требует отдельного игрового сервиса и пока не поддерживается Minimal Launcher.'

type Build = { version?: string | null; loader?: string | null }

/** A catalogue game that is not Minecraft: no Minecraft version, loader, servers or mods apply to it. */
export const isNativeGame = (p: Build | null | undefined): boolean =>
  !!p && p.version === NATIVE_GAME_VERSION && p.loader === NATIVE_LOADER
