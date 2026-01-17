import * as vscode from 'vscode';
import path from 'node:path';

const KEYBINDINGS_FILE_NAME = 'keybindings.json';
const APP_FOLDER = 'Code';
const USER_FOLDER = 'User';

interface Keybinding {
	key?: string;
	command?: string;
	when?: string;
}

let diagnosticCollection: vscode.DiagnosticCollection;

const getAllCommands = async (): Promise<Set<string>> => {
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
		} catch {}
	}

	return allCommands;
};

const findKeybindingRange = (
	document: vscode.TextDocument,
	keybinding: Keybinding,
): vscode.Range | null => {
	if (!keybinding.command) {
		return null;
	}

	const content = document.getText();

	const commandStr = `"command": "${keybinding.command}"`;
	const commandIndex = content.indexOf(commandStr);

	if (commandIndex === -1) {
		return null;
	}

	let objStart = content.lastIndexOf('{', commandIndex);
	if (objStart === -1) {
		return null;
	}

	let objEnd = content.indexOf('}', commandIndex);
	if (objEnd === -1) {
		return null;
	}

	const startPos = document.positionAt(objStart);
	const endPos = document.positionAt(objEnd + 1);

	return new vscode.Range(startPos, endPos);
};

const updateDiagnostics = async (document: vscode.TextDocument): Promise<void> => {
	diagnosticCollection.delete(document.uri);

	const currentFilePath = document.uri.fsPath;
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

	try {
		const content = document.getText();
		const keybindings = JSON.parse(content);
		const allCommands = await getAllCommands();

		const diagnostics: vscode.Diagnostic[] = [];

		for (const kb of keybindings as Keybinding[]) {
			const range = findKeybindingRange(document, kb);

			if (!range) {
				continue;
			}

			if (!kb.command) {
				const diagnostic = new vscode.Diagnostic(
					range,
					'Missing "command" property in keybinding',
					vscode.DiagnosticSeverity.Error,
				);
				diagnostic.code = 'missing-command';
				diagnostics.push(diagnostic);
				continue;
			}

			const commandId = kb.command.startsWith('-') ? kb.command.substring(1) : kb.command;
			if (!allCommands.has(commandId)) {
				const diagnostic = new vscode.Diagnostic(
					range,
					`Unknown command: "${kb.command}". This keybinding will not work.`,
					vscode.DiagnosticSeverity.Warning,
				);
				diagnostic.code = 'unknown-command';
				diagnostic.relatedInformation = [
					new vscode.DiagnosticRelatedInformation(
						new vscode.Location(document.uri, range),
						`Command "${commandId}" is not registered in VS Code`,
					),
				];
				diagnostics.push(diagnostic);
			}
		}

		diagnosticCollection.set(document.uri, diagnostics);
	} catch (error) {
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 0, document.lineCount - 1, 0),
			`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
			vscode.DiagnosticSeverity.Error,
		);
		diagnostic.code = 'invalid-json';
		diagnosticCollection.set(document.uri, [diagnostic]);
	}
};

class KeybindingCodeActionProvider implements vscode.CodeActionProvider {
	public static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

	public provideCodeActions(
		document: vscode.TextDocument,
		_range: vscode.Range | vscode.Selection,
		context: vscode.CodeActionContext,
		_token: vscode.CancellationToken,
	): vscode.ProviderResult<vscode.CodeAction[]> {
		const diagnostics = context.diagnostics;
		if (!diagnostics.length) {
			return [];
		}

		const relevantDiagnostics = diagnostics.filter(
			(d) => d.code === 'unknown-command' || d.code === 'missing-command',
		);

		if (!relevantDiagnostics.length) {
			return [];
		}

		const actions: vscode.CodeAction[] = [];

		for (const diagnostic of relevantDiagnostics) {
			const action = new vscode.CodeAction(
				'Delete this keybinding',
				vscode.CodeActionKind.QuickFix,
			);
			action.diagnostics = [diagnostic];
			action.isPreferred = true;

			const edit = new vscode.WorkspaceEdit();
			const range = diagnostic.range;

			const textAfter = document.getText(
				new vscode.Range(range.end, document.lineAt(range.end.line).range.end),
			);
			const commaRegex = /^\s*,/;
			const commaMatch = commaRegex.exec(textAfter);

			let deleteRange = range;

			if (commaMatch) {
				deleteRange = new vscode.Range(
					range.start,
					new vscode.Position(range.end.line, range.end.character + commaMatch[0].length),
				);
			} else if (range.start.line > 0) {
				const prevLine = document.lineAt(range.start.line - 1);
				const prevLineText = prevLine.text;
				const trailingCommaRegex = /^(.*)\s*,\s*$/;
				const trailingCommaMatch = trailingCommaRegex.exec(prevLineText);

				if (trailingCommaMatch) {
					const commaStart = prevLine.text.lastIndexOf(',');
					deleteRange = new vscode.Range(
						new vscode.Position(range.start.line - 1, commaStart),
						range.end,
					);
				}
			}

			edit.delete(document.uri, deleteRange);

			action.edit = edit;

			actions.push(action);
		}

		return actions;
	}
}

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

	const content = activeEditor.document.getText();
	const keybindings = JSON.parse(content);
	const allCommands = await getAllCommands();

	const validKeybindings = (keybindings as Keybinding[]).filter((kb) => {
		if (!kb.command) {
			return false;
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
		await updateDiagnostics(document);
	}
};

const activate = (context: vscode.ExtensionContext) => {
	diagnosticCollection = vscode.languages.createDiagnosticCollection('keymap-cleaner');

	const codeActionProvider = vscode.languages.registerCodeActionsProvider(
		{ pattern: '**/keybindings.json' },
		new KeybindingCodeActionProvider(),
		{
			providedCodeActionKinds: KeybindingCodeActionProvider.providedCodeActionKinds,
		},
	);

	const documentChangeListener = vscode.workspace.onDidChangeTextDocument(async (event) => {
		await updateDiagnostics(event.document);
	});

	const documentOpenListener = vscode.workspace.onDidOpenTextDocument(async (document) => {
		await updateDiagnostics(document);
	});

	const command = vscode.commands.registerCommand('keymap-cleaner.run', cleanKeybindings);

	context.subscriptions.push(
		diagnosticCollection,
		codeActionProvider,
		documentChangeListener,
		documentOpenListener,
		command,
	);

	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document);
	}
};

const deactivate = (): void => {
	if (diagnosticCollection) {
		diagnosticCollection.dispose();
	}
};

export { activate, deactivate };
