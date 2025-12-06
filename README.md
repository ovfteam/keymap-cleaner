# Keymap Cleaner

Remove unused keybindings in VS Code to keep your configuration clean and optimized.

## Features

- **Automatically detects unused keybindings**: Scans your keybindings.json file and removes commands that are no longer available
- **Supports all command sources**: Checks commands from:
  - VS Code built-in commands
  - Currently activated extensions
  - All installed extensions
- **Safe operation**: Only removes keybindings for commands that don't exist in your current VS Code environment

- **Easy to use**: Right-click on your keybindings.json file and select "Clean Keybindings"

## How to Use

1. Open your keybindings.json file in VS Code
   - You can open it via the command palette: `> Open Keyboard Shortcuts (JSON)`
2. Right-click anywhere in the editor
3. Select "Clean Keybindings" from the context menu
4. The extension will automatically remove any keybindings that reference non-existent commands

## Requirements

- Visual Studio Code 1.106.1 or higher

## Extension Settings

This extension does not add any VS Code settings. It operates directly on the keybindings.json file when triggered manually.

## Known Issues

- Only works on Windows (uses %APPDATA% to locate keybindings.json)
- Backup your keybindings.json before cleaning in case you need to restore any custom keybindings

## For More Information

- Extension homepage: [https://ovfteam.com/](https://ovfteam.com/vsc-ext/keymap-cleaner)
- Repository: [https://github.com/ovfteam/keymap-cleaner](https://github.com/ovfteam/keymap-cleaner)

**Enjoy your clean keybindings!**
