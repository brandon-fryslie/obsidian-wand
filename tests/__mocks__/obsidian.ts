/**
 * Mock Obsidian API for testing
 * This file is automatically used by Jest via moduleNameMapper
 */

export class App {
  vault: any;
  workspace: any;
  fileManager: any;
  commands: any;
  keymap: any;
  scope: any;
  metadataCache: any;
  lastEvent: any;

  constructor() {
    this.vault = {
      getRoot: jest.fn(() => ({ path: "/test/vault" })),
      getAbstractFileByPath: jest.fn(),
      read: jest.fn(),
      write: jest.fn(),
      create: jest.fn(),
      createFolder: jest.fn(),
      delete: jest.fn(),
      getMarkdownFiles: jest.fn(() => []),
      adapter: {
        exists: jest.fn(),
        mkdir: jest.fn(),
        read: jest.fn(),
        write: jest.fn(),
        remove: jest.fn(),
        rename: jest.fn(),
        list: jest.fn(),
      },
    };

    this.workspace = {
      getActiveFile: jest.fn(),
      getActiveViewOfType: jest.fn(),
      getLeaves: jest.fn(() => []),
      getLeaf: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      trigger: jest.fn(),
      activeLeaf: null,
      leftSplit: null,
      rightSplit: null,
    };

    this.fileManager = {
      renameFile: jest.fn(),
      processFrontMatter: jest.fn(),
    };

    this.commands = {
      commands: {},
      executeCommandById: jest.fn(),
      listCommands: jest.fn(() => []),
      addCommand: jest.fn(),
      removeCommand: jest.fn(),
    };

    this.keymap = {
      pushScope: jest.fn(),
      popScope: jest.fn(),
    };

    this.scope = {
      register: jest.fn(),
      unregister: jest.fn(),
    };

    this.metadataCache = {
      getFileCache: jest.fn(),
      getCache: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };

    this.lastEvent = null;
  }
}

export class Plugin {
  app: App;
  manifest: any;

  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand = jest.fn();
  addRibbonIcon = jest.fn();
  addStatusBarItem = jest.fn();
  addSettingTab = jest.fn();
  registerView = jest.fn();
  registerExtensions = jest.fn();
  registerMarkdownCodeBlockProcessor = jest.fn();
  registerMarkdownPostProcessor = jest.fn();
  registerEditorExtension = jest.fn();
  registerObsidianProtocolHandler = jest.fn();
  registerDomEvent = jest.fn();
  registerInterval = jest.fn();
  loadData = jest.fn(async () => ({}));
  saveData = jest.fn(async () => {});
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  display = jest.fn();
  hide = jest.fn();
}

export class Setting {
  settingEl: HTMLElement;

  constructor(_containerEl: HTMLElement) {
    this.settingEl = document.createElement("div");
  }

  setName = jest.fn(() => this);
  setDesc = jest.fn(() => this);
  addText = jest.fn(() => this);
  addTextArea = jest.fn(() => this);
  addToggle = jest.fn(() => this);
  addDropdown = jest.fn(() => this);
  addSlider = jest.fn(() => this);
  addButton = jest.fn(() => this);
  setClass = jest.fn(() => this);
  setDisabled = jest.fn(() => this);
}

export class ItemView {
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.view?.app || new App();
    this.containerEl = document.createElement("div");
    this.contentEl = document.createElement("div");
  }

  getViewType = jest.fn(() => "unknown");
  getDisplayText = jest.fn(() => "Unknown View");
  onOpen = jest.fn(async () => {});
  onClose = jest.fn(async () => {});
}

export class MarkdownView extends ItemView {
  editor: any;
  file: TFile | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.editor = {
      getSelection: jest.fn(() => ""),
      replaceSelection: jest.fn(),
      getCursor: jest.fn(() => ({ line: 0, ch: 0 })),
      setCursor: jest.fn(),
      getValue: jest.fn(() => ""),
      setValue: jest.fn(),
      getLine: jest.fn(() => ""),
      lineCount: jest.fn(() => 0),
      replaceRange: jest.fn(),
    };
  }

  getViewType = jest.fn(() => "markdown");
}

export class WorkspaceLeaf {
  view: any;
  parent: any;

  constructor() {
    this.view = null;
    this.parent = null;
  }

  setViewState = jest.fn(async () => {});
  open = jest.fn(async () => {});
  openFile = jest.fn(async () => {});
  detach = jest.fn();
}

export class TFile {
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { ctime: number; mtime: number; size: number };
  vault: any;
  parent: TFolder | null;

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() || path;
    const parts = this.name.split(".");
    this.extension = parts.length > 1 ? parts.pop()! : "";
    this.basename = parts.join(".");
    this.stat = {
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0,
    };
    this.vault = null;
    this.parent = null;
  }
}

export class TFolder {
  path: string;
  name: string;
  children: (TFile | TFolder)[];
  vault: any;
  parent: TFolder | null;
  isRoot: boolean;

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() || path;
    this.children = [];
    this.vault = null;
    this.parent = null;
    this.isRoot = path === "/";
  }
}

export class Notice {
  constructor(_message: string, _timeout?: number) {
    // Mock implementation
  }

  hide = jest.fn();
  setMessage = jest.fn();
}

export function normalizePath(path: string): string {
  // Basic path normalization
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function addIcon(_iconId: string, _svgContent: string): void {
  // Mock implementation
}

export function setIcon(_el: HTMLElement, _iconId: string): void {
  // Mock implementation
}

export const Platform = {
  isMobile: false,
  isDesktop: true,
  isMacOS: process.platform === "darwin",
  isWin: process.platform === "win32",
  isLinux: process.platform === "linux",
  isIosApp: false,
  isAndroidApp: false,
};

export const Vault = {
  recurseChildren: jest.fn((folder: TFolder, callback: (file: TFile) => void) => {
    folder.children.forEach((child) => {
      if (child instanceof TFile) {
        callback(child);
      } else if (child instanceof TFolder) {
        Vault.recurseChildren(child, callback);
      }
    });
  }),
};

export const FileSystemAdapter = jest.fn();

export const requestUrl = jest.fn();

export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

export const moment = jest.fn(() => ({
  format: jest.fn(() => "2024-01-01"),
  fromNow: jest.fn(() => "just now"),
  diff: jest.fn(() => 0),
}));

// Export everything that might be needed
export default {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  ItemView,
  MarkdownView,
  WorkspaceLeaf,
  TFile,
  TFolder,
  Notice,
  normalizePath,
  addIcon,
  setIcon,
  Platform,
  Vault,
  FileSystemAdapter,
  requestUrl,
  debounce,
  moment,
};
