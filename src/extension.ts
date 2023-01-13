/**
 * This file is part of the vscode-php-cs-fixer distribution.
 * Copyright (c) Satiro Marra.
 *
 * vscode-php-cs-fixer is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * vscode-php-cs-fixer is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import {
  WorkspaceConfiguration,
  workspace,
  commands,
  TextDocument,
  window,
  ExtensionContext,
  ConfigurationChangeEvent,
  TextEditor,
  Disposable,
  languages,
  Range,
  Position,
  TextEdit,
  WorkspaceFolder,
  Uri
} from 'vscode';
import { spawn } from 'child_process';
import { existsSync, writeFileSync, unlink, readFileSync, chmodSync, chmod, unlinkSync, renameSync } from 'fs';
import { basename, isAbsolute, join, normalize } from 'path';
import { homedir, tmpdir } from 'os'
import { DownloaderHelper } from 'node-downloader-helper'

interface Config extends WorkspaceConfiguration {
  execPath?: string;
  rules?: string | object;
  config?: string;
  onsave?: boolean;
  lastUpdate?: number;
  formattingProvider?: boolean;
  allowRisky?: boolean;
}

class PHPCSFIXER {
  private isReloadingConfig: Boolean = false;
  private isDeactivating: Boolean = false;
  private isFixing: Boolean = false;
  private config: Config;
  private fixOnSave: Disposable;
  private realExecPath: string;
  private execPath: string;

  public _rp: Boolean = false;
  public formattingProvider: boolean = true;

  private readConfig() {
    if (this.isReloadingConfig) {
      return;
    }
    this.isReloadingConfig = true;
    let f = workspace.getWorkspaceFolder(window.activeTextEditor?.document?.uri || workspace.workspaceFolders[0].uri)
    try {
      this.config = workspace.getConfiguration("phpcsfixer", f.uri) || <any>{};
      // console.log(this.config)
    } catch (error) {
      // console.error(error);
      this.isReloadingConfig = false;
      return;
    } finally {
      // console.log("finally")
    }
    if (this.config.onsave && !this.fixOnSave) {
      this.fixOnSave = workspace.onDidSaveTextDocument(document => {
        this.onDidSaveTextDocument(document);
      });
    } else if (!this.config.onsave && this.fixOnSave) {
      this.fixOnSave.dispose();
      this.fixOnSave = undefined;
    }
    this.execPath = this.resolvePaths(this.config.execPath || (process.platform === "win32" ? 'php-cs-fixer.bat' : 'php-cs-fixer'));
    this.formattingProvider = this.config.formattingProvider;
    this.isReloadingConfig = false;
    return;
  }

  public resolvePaths(input: string, context: { uri?: Uri } = {}) {
    const pattern = /^\$\{workspace(Root|Folder)\}/
    if (pattern.test(input) && context.uri) {
      const workspaceFolder = this.getActiveWorkspaceFolder(context.uri)
      if (workspaceFolder !== null && workspaceFolder.uri.scheme === 'file') {
        input = input.replace(pattern, workspaceFolder.uri.fsPath)
      }
    }
    input = input.replace('${extensionPath}', __dirname)
    input = input.replace(/^~\//, homedir() + '/')
    return normalize(input)
  }

  public getActiveWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined {
    let candidate = workspace.getWorkspaceFolder(uri)
    // Fallback to using the single root workspace's folder. Multi-root
    // workspaces should not be used because its impossible to guess which one
    // the developer intended to use.
    if (candidate === undefined && workspace.workspaceFolders?.length === 1) {
      candidate = workspace.workspaceFolders[0]
    }
    return candidate
  }

  public constructor() {
    this.initialize();
    this.updatePhar();
  }

  public async initialize() {
    this.readConfig();
  }

  public onSave(): boolean {
    this.readConfig();
    return this.config.onsave;
  }

  public async onDidChangeConfiguration() {
    this.readConfig();
  }

  public getActiveWorkspacePath() {
    let u = window.activeTextEditor?.document?.uri;
    if (u !== undefined) {
      let f = workspace.getWorkspaceFolder(u);
      if (f != undefined) {
        return f.uri.fsPath
      }
    }
    if (workspace.workspaceFolders != undefined) {
      return workspace.workspaceFolders[0].uri.fsPath
    }
    return
  }
  public registerDiffDocumentProvider(uri: Uri) {
    this.fixDocument(readFileSync(uri.fsPath, 'utf-8'), uri, true, false)
      .then((tempFilePath) => {
        let fname = basename(uri.fsPath);
        commands.executeCommand('vscode.diff', uri, Uri.file(tempFilePath), 'view diff: ' + fname)
      })
      .catch((err) => {
        console.error(err)
      });
  }
  public registerRangeDocumentProvider(document: TextDocument, range: Range): Promise<TextEdit[]> {
    if (window.activeTextEditor == undefined
      || (window.activeTextEditor.document.uri.toString() != document.uri.toString())) {
      return
    }
    return new Promise((resolve, reject) => {
      let oText = document.getText(range)
      if (oText.replace(/\s+/g, '').length == 0) {
        reject()
        return
      }
      if (this.isFixing) {
        resolve([]);
        return;
      }
      let lastSpaces = oText.match(/(\n\s*)+$/)
      let firstSpaces = oText.match(/^(\n\s*)+/)
      let PHPTag = (oText.search(/^\s*<\?php/i) == -1)
      if (PHPTag) {
        oText = '<?php\n' + oText
      }
      this
        .fixDocument(oText, document.uri, false, true)
        .then((text: string) => {
          if (PHPTag) {
            // text = text.replace(/^<\?php\r?\n+/, '').replace(/\n$/, '')
            text = text.replace(/^<\?php\r?(\n\s*)+/, '').replace(/(\n\s*)+$/, '')
          }
          if (firstSpaces) {
            text = firstSpaces[0] + text
          }
          if (lastSpaces) {
            text = text + lastSpaces[0]
          }
          if (text && text != oText) {
            resolve([new TextEdit(range, text)])
          } else {
            resolve([])
          }
        }).catch(err => {
          //console.log("ERR: " + err)
          reject()
        })
    });
  }

  public registerDocumentProvider(document: TextDocument, options): Promise<TextEdit[]> {
    if (window.activeTextEditor == undefined
      || (window.activeTextEditor.document.uri.toString() != document.uri.toString())) {
      return
    }

    return new Promise((resolve, reject) => {
      let oText = document.getText()
      let lLine = document.lineAt(document.lineCount - 1)
      let range = new Range(new Position(0, 0), lLine.range.end)
      if (this.isFixing) {
        resolve([]);
        return;
      }
      this
        .fixDocument(oText, document.uri, false, false)
        .then((text: string) => {
          if (text != oText) {
            resolve([new TextEdit(range, text)])
          } else {
            resolve([])
          }
        }).catch(err => {
          // console.log("ERR: " + err)
          reject(err)
        })
    });
  }
  public getArgs() {
    let args = ['fix', '--using-cache=no', '--path-mode=override', '-vv'];
    let rootPath = this.getActiveWorkspacePath()
    let cFiles = this.config.config.split(';').filter(f => '' !== f).map(f => f.replace(/^~\//, homedir() + '/'))
    let searchPaths = []
    const files = []
    let useConfig = false;
    this.realExecPath = undefined
    if (workspace.workspaceFolders != undefined) {
      //this.realExecPath = this.execPath.replace(/^\$\{workspace(Root|Folder)\}/, rootPath || workspace.workspaceFolders[0].uri.fsPath)
      this.realExecPath = this.resolvePaths(this.execPath)
    }
    if (rootPath !== undefined) {
      searchPaths = ['.vscode', ''].map(f => rootPath + '/' + (f ? f + '/' : ''))
    }
    for (const file of cFiles) {
      if (isAbsolute(file)) {
        files.push(file)
      } else if (searchPaths.length > 0) {
        for (const searchPath of searchPaths) {
          files.push(searchPath + file)
        }
      }
    }
    for (let i = 0, len = files.length; i < len; i++) {
      if (existsSync(files[i])) {
        args.push('--config=' + files[i])
        useConfig = true
        break
      }
    }
    if (!useConfig && this.config.rules) {
      if (typeof (this.config.rules) == 'object') {
        args.push('--rules=' + JSON.stringify(this.config.rules))
      } else {
        args.push('--rules=' + this.config.rules)
      }
    }
    if (!useConfig && this.config.allowRisky) {
      args.push('--allow-risky=yes');
    }
    return args
  }

  public async fixDocument(text: string, uri: Uri, diff: boolean = false, partial: boolean = false): Promise<string> {
    if (this.isFixing) {
      // this.isFixing
      // console.log(this.isFixing, this._rp);
      return new Promise((resolve, reject) => {
        //reject("pi pi pi");
        resolve(diff ? filePath : text);
      });
    }
    let filePath: string
    this.isFixing = true
    if (partial) {
      filePath = tmpdir() + '/tmp-phpcsfixer-partial.php';
    } else {
      filePath = tmpdir() + uri.fsPath.replace(/^.*[\\/]/, '/')
    }
    writeFileSync(filePath, text)
    const args = this.getArgs()
    if (partial) {
      args.push('-q')
    }
    args.push(filePath)
    console.log(this.realExecPath || this.execPath, args.join(' '));
    let ev = process.env;
    ev.PROJECT_WORKSPACE = ev.VSCODE_WORKSPACE = this.getActiveWorkspacePath() + '/';
    let envi = {
      cwd: process.cwd(),
      env: ev
    };

    const prcs = spawn(this.realExecPath || this.execPath, args, envi);
    let promise: Promise<string> = new Promise((resolve, reject) => {
      prcs.on("error", (err) => {
        partial || reject(err);
        this.isFixing = false
      });
      prcs.on('exit', (code) => {
        if (code == 0) {
          if (diff) {
            resolve(filePath)
          } else {
            try {
              let fixed = readFileSync(filePath, 'utf-8')
              if (fixed.length > 0) {
                resolve(fixed)
              } else {
                reject();
              }
            } catch (err) {
              reject(err)
            }
          }
          showView('success', 'PHP CS Fixer: Fixed all files!');
        } else {
          let msgs = {
            1: 'PHP CS Fixer: php general error.',
            16: 'PHP CS Fixer: Configuration error of the application.',
            32: 'PHP CS Fixer: Configuration error of a Fixer.',
            64: 'PHP CS Fixer: Exception raised within the application.',
            'fallback': 'PHP CS Fixer: Unknown error.'
          }
          let msg = msgs[code in msgs ? code : 'fallback']
          if (!partial && code != 16)
            showView('error', msg)
          reject(msg)
        }

        // console.log('fix', this.isFixing)
        // unlinkSync(filePath)
        if (!diff && !partial) {
          unlink(filePath, function (err) {
            //console.log("Deleted file: " + filePath)
          })
        }
        this.isFixing = false
        this._rp = false;
        // console.log('rp', this._rp);
      });
    });
    prcs.stdout.on('data', (buffer) => {
      // console.log(buffer.toString())
    });
    prcs.stderr.on('data', (buffer) => {
      let err = buffer.toString();
      if (partial) {
        // console.error(err)
        return
      }
      if (err.includes('Files that were not fixed due to errors reported during linting before fixing:')) {
        showView('error', "phpcsfixer: php syntax error" + (err.split('before fixing:')[1]))
      } else if (err.includes('Configuration file `.php_cs` is outdated, rename to `.php-cs-fixer.php`.')) {
        showView('info', 'Configuration file `.php_cs` is outdated, rename to `.php-cs-fixer.php`.')
      }
    });
    return promise;
  }

  public async updatePhar() {
    setTimeout(() => {
      let config = this.config;
      let lastUpdate = config.get('lastUpdate', 1)
      if (lastUpdate == 0) return;
      if (this.config.execPath == '${extensionPath}/php-cs-fixer.phar' && lastUpdate + 1000 * 604800 < (new Date()).getTime()) {
        let _opts = {
          'fileName': 'php-cs-fixer.temp',
          'override': true
        }
        //if (existsSync(__dirname + '/' + _opts.fileName)) {
        //  unlink(__dirname + '/' + _opts.fileName, () => { });
        //}
        let dl = new DownloaderHelper('https://cs.symfony.com/download/php-cs-fixer-v3.phar', __dirname, _opts)
        dl.on('end', () => {
          unlinkSync(join(__dirname, 'php-cs-fixer.phar'))
          renameSync(join(__dirname, 'php-cs-fixer.temp'), join(__dirname, 'php-cs-fixer.phar'))
          config.update('lastUpdate', (new Date()).getTime(), true)
          try {
            chmod(__dirname + '/' + _opts.fileName, 0o755, () => {
              // console.log("make it executable!");
            })
          } catch (error) {
            // console.log(error)
          } finally {
            // holi
          }
        })
        dl.on('error', (err) => {
          // console.log(err)
        })
        dl.start()
      }
    }, 1000 * 10)
  }

  public async onDidSaveTextDocument(document: TextDocument) {
    if (document.languageId !== 'php') {
      return;
    }
    if (this.config.onsave === true && this._rp === false) {
      this._rp = true;
      commands.executeCommand("editor.action.formatDocument")
    }
  }

  public async deactivate() {
    if (this.isDeactivating) {
      return;
    }
    this.isDeactivating = true;
    showView('info', 'Extension deactivated');
  }
}

function showView(type: string, message: string): void {
  switch (type) {
    case 'success':
      window.setStatusBarMessage(message, 5000);
      break;
    case 'info':
      window.showInformationMessage(message);
      break;
    case 'error':
      window.showErrorMessage(message);
      break;
    case 'warning':
      window.showWarningMessage(message);
      break;
  }
}

const WD: PHPCSFIXER = new PHPCSFIXER();

export async function activate(context: ExtensionContext) {
  WD.onDidChangeConfiguration();
  /*context.subscriptions.push(workspace.onDidSaveTextDocument(async (e: TextDocument) => {
    WD.onDidSaveTextDocument(e);
  }));*/

  context.subscriptions.push(workspace.onWillSaveTextDocument((event) => {
    // WD.onDidSaveTextDocument(event.document)
    //console.log("onWillSaveTextDocument")
    if (event.document.languageId == 'php' && WD.onSave() && WD._rp === false) {
      WD._rp = true;
      event.waitUntil(commands.executeCommand("editor.action.formatDocument"))
    }
  }));

  context.subscriptions.push(commands.registerTextEditorCommand('phpcsfixer.fix', async (textEditor: TextEditor) => {
    // WD.onDidSaveTextDocument(textEditor.document)
    //console.log("registerTextEditorCommand")
    if (WD._rp === false && textEditor.document.languageId == 'php') {
      WD._rp = true;
      commands.executeCommand("editor.action.formatDocument")
    }
  }));

  context.subscriptions.push(workspace.onDidChangeConfiguration(async (e: ConfigurationChangeEvent) => {
    WD.onDidChangeConfiguration();
  }));
  if (WD.formattingProvider) {
    context.subscriptions.push(languages.registerDocumentFormattingEditProvider('php', {
      provideDocumentFormattingEdits: (document, options, token) => {
        return WD.registerDocumentProvider(document, options);
      }
    }));
    context.subscriptions.push(languages.registerDocumentRangeFormattingEditProvider('php', {
      provideDocumentRangeFormattingEdits(document, range, options, token) {
        return WD.registerRangeDocumentProvider(document, range);
      },
    }));
  }
  context.subscriptions.push(commands.registerCommand('phpcsfixer.diff', (f) => {
    if (f == undefined) {
      let editor = window.activeTextEditor
      if (editor != undefined && editor.document.languageId == 'php') {
        f = editor.document.uri
      }
    }
    if (f && f.scheme == 'file') {
      WD.registerDiffDocumentProvider(f);
    }
  })
  )

}
export async function deactivate() {
  WD.deactivate();
}
