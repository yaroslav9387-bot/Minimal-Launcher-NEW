# Minimal Launcher

**Minimal Launcher** — независимая сборка на основе исходного проекта Millida Launcher. Проект использует React, TypeScript, Rust и Tauri 2; лицензия исходной основы — **GPL-3.0-only**. Требуемые лицензионные и авторские уведомления сохранены. Minimal Launcher не связан с Mojang или Microsoft.

## Что есть в этой версии

- Тёмный интерфейс с зелёными акцентами: главная, библиотека, моды, серверы, друзья и настройки.
- Локальные профили Minecraft, создание и импорт сборок.
- Существующий механизм установки и запуска Minecraft.
- Каталог модов через прямой Modrinth API.
- Локальный список серверов и подключение по адресу.
- Локальный список игровых ников.

## Что пока не подключено

- Онлайн-друзья, чат, звонки, приглашения и группы — нужен собственный сервер Minimal Launcher.
- Облачная синхронизация и хостинг — нужен собственный backend.
- Вход Microsoft — требуется собственное приложение Microsoft Entra. При сборке его ID задаётся через `MINIMAL_LAUNCHER_MS_CLIENT_ID`. Чужой ID upstream-проекта не используется.
- Автообновление — выключено до настройки собственного подписанного канала обновлений.
- CurseForge в новой оболочке пока не включён.

## Сборка для Windows

Нужны Bun, Rust toolchain, Visual Studio C++ Build Tools и WebView2 Runtime. В PowerShell из корневой папки:

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build:web
bun run build:release
```

Установщик Tauri должен появиться в `src-tauri/target/release/bundle/`. Сборка считается проверенной только после запуска установщика и теста запуска Minecraft на Windows.

## Состояние разработки

Эта копия исходников ещё не прошла полный TypeScript/Rust/Windows build. Не распространяйте её как готовый установщик. Подробности — в [MINIMAL_LAUNCHER_STATUS.ru.md](MINIMAL_LAUNCHER_STATUS.ru.md) и [MIGRATION_PROGRESS.ru.md](MIGRATION_PROGRESS.ru.md).

## Лицензия и происхождение

Исходная основа: [Millida Launcher](https://github.com/millida/launcher). Лицензия GPL-3.0-only и обязательные уведомления сохранены. См. [LICENSE](LICENSE), [NOTICE](NOTICE) и [THIRD-PARTY.ru.md](THIRD-PARTY.ru.md).
