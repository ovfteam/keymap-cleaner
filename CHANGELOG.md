# Changelog

## [Unreleased]

### Planned

- Cross-platform support for macOS and Linux
- Configurable keybindings file location
- Undo functionality for cleaned keybindings
- Command palette integration

## [0.0.2] - 2026-01-18

### Fixed

- Fixed potential issue where extensions without `contributes` field would
  cause early return instead of continuing to next extension
- Added constants for keybindings file path components
  (`KEYBINDINGS_FILE_NAME`, `APP_FOLDER`, `USER_FOLDER`)

## [0.0.1] - 2025-12-06

### Added

- Initial release of Keymap Cleaner extension
- Automatically detect and remove unused keybindings from keybindings.json
- Support for scanning commands from:
  - VS Code built-in commands
  - Currently activated extensions
  - All installed extensions
- Context menu integration for easy access
- Safe operation that only removes non-existent commands

### Known Limitations

- Currently only supports Windows (uses %APPDATA% to locate keybindings.json)

[unreleased]: https://github.com/ovfteam/keymap-cleaner/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/ovfteam/keymap-cleaner/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/ovfteam/keymap-cleaner/releases/tag/v0.0.1
