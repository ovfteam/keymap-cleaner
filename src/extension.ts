import * as vscode from 'vscode';
import path from 'node:path';
import * as fs from 'node:fs';

const KEYBINDINGS_FILE_NAME = 'keybindings.json';
const APP_FOLDER = 'Code';
const USER_FOLDER = 'User';

const cleanKeybindings = async (): Promise<void> => {
	const activeEditor = vscode.window.activeTextEditor;
	if (!activeEditor) {
		return;
	}

	const currentFilePath = activeEditor.document.uri.fsPath;
	const keybindingsPath = path.join(
		process.env['APPDATA'] || '',
		APP_FOLDER,
		USER_FOLDER,
		KEYBINDINGS_FILE_NAME,
	);

	const normalizedCurrentPath = path.resolve(currentFilePath.replaceAll('/', path.sep));
	const normalizedKeybindingsPath = path.resolve(keybindingsPath);
	const isKeybindingsFile =
		normalizedCurrentPath.toLowerCase() === normalizedKeybindingsPath.toLowerCase();

	if (!isKeybindingsFile) {
		return;
	}

	const content = fs.readFileSync(keybindingsPath, 'utf8');
	const keybindings = JSON.parse(content);
	const allCommands = new Set<string>();

	const allAvailableCommands = await vscode.commands.getCommands(true);
	for (const cmd of allAvailableCommands) {
		allCommands.add(cmd);
	}

	const activatedCommands = await vscode.commands.getCommands(false);
	for (const cmd of activatedCommands) {
		allCommands.add(cmd);
	}

	const extensions = vscode.extensions.all;
	for (const extension of extensions) {
		try {
			const contributes = extension.packageJSON.contributes;
			if (!contributes) {
				continue;
			}

			if (contributes.commands) {
				for (const cmd of contributes.commands) {
					if (cmd.command) {
						allCommands.add(cmd.command);
					}
				}
			}

			if (contributes.keybindings) {
				for (const kb of contributes.keybindings) {
					if (kb.command) {
						allCommands.add(kb.command);
					}
				}
			}
		} catch {
			// ignore error
		}
	}

	const validKeybindings = keybindings.filter((kb: any) => {
		if (!kb.command) {
			return true;
		}
		const commandId = kb.command.startsWith('-') ? kb.command.substring(1) : kb.command;
		return allCommands.has(commandId);
	});

	const edit = new vscode.WorkspaceEdit();
	const document = activeEditor.document;
	const cleanedContent = JSON.stringify(validKeybindings, null, 2);
	edit.replace(
		document.uri,
		new vscode.Range(
			new vscode.Position(0, 0),
			document.lineAt(document.lineCount - 1).range.end,
		),
		cleanedContent,
	);

	const success = await vscode.workspace.applyEdit(edit);
	if (success) {
		await document.save();
	}
};

const activate = (context: vscode.ExtensionContext) => {
	context.subscriptions.push(
		vscode.commands.registerCommand('keymap-cleaner.run', cleanKeybindings),
	);
};

const deactivate = (): void => {};

export { activate, deactivate };
