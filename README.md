# Minimal Launcher

**Minimal Launcher** is an independent build based on the Millida Launcher source project. It uses React, TypeScript, Rust and Tauri 2. The upstream source is licensed under **GPL-3.0-only**; required license and copyright notices are preserved. Minimal Launcher is not affiliated with Mojang or Microsoft.

## Available in this build

- Dark interface with green accents: Home, Library, Mods, Servers, Friends and Settings.
- Local Minecraft profiles, instance creation and import.
- Existing Minecraft installation and launch mechanisms.
- Mod catalog through the direct Modrinth API.
- Local server list and address-based joining.
- Local list of Minecraft nicknames.

## Not connected yet

- Online friends, chat, calls, invites and groups require a Minimal Launcher server.
- Cloud sync and hosting require a project-owned backend.
- Microsoft sign-in requires a project-owned Microsoft Entra application. Set its ID at build time with `MINIMAL_LAUNCHER_MS_CLIENT_ID`. No upstream client ID is reused.
- Automatic updates are disabled until a project-owned signed update channel is configured.
- CurseForge is not enabled in the new shell yet.

## Build for Windows

Install Bun, the Rust toolchain, Visual Studio C++ Build Tools and WebView2 Runtime. From the project root in PowerShell:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build:web
bun run build:release
```

The Tauri installer should appear under `src-tauri/target/release/bundle/`. Treat a build as verified only after installing it and testing Minecraft launch on Windows.

## Development status

This source copy has not passed the full TypeScript/Rust/Windows build yet. Do not distribute it as a finished installer. See [MINIMAL_LAUNCHER_STATUS.ru.md](MINIMAL_LAUNCHER_STATUS.ru.md) and [MIGRATION_PROGRESS.ru.md](MIGRATION_PROGRESS.ru.md).

## License and origin

Source base: [Millida Launcher](https://github.com/millida/launcher). GPL-3.0-only and required notices are preserved. See [LICENSE](LICENSE), [NOTICE](NOTICE) and [THIRD-PARTY.md](THIRD-PARTY.md).
