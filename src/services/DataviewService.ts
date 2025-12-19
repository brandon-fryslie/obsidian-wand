import { App, TFile } from "obsidian";
import { getAPI, DataviewApi } from "obsidian-dataview";

export interface DataviewQueryResult {
  type: "list" | "table" | "task" | "calendar";
  values: any[];
  headers?: string[];
}

export interface PageData {
  path: string;
  name: string;
  tags: string[];
  aliases: string[];
  frontmatter: Record<string, any>;
  links: {
    inlinks: string[];
    outlinks: string[];
  };
  tasks: TaskData[];
  created: Date | null;
  modified: Date | null;
}

export interface TaskData {
  text: string;
  completed: boolean;
  line: number;
  path: string;
  tags: string[];
  due?: Date;
}

export interface DataviewStatus {
  available: boolean;
  version?: string;
  indexed: boolean;
  pageCount?: number;
}

/**
 * DataviewService provides a high-level interface to Dataview's API.
 * It handles detection, initialization, and provides typed methods for common operations.
 */
export class DataviewService {
  private app: App;
  private api: DataviewApi | undefined;
  private indexReady: boolean = false;
  private indexReadyPromise: Promise<void> | null = null;
  private indexReadyResolve: (() => void) | null = null;

  constructor(app: App) {
    this.app = app;
    this.initialize();
  }

  private initialize(): void {
    // Try to get the API immediately
    this.api = getAPI(this.app);

    if (this.api) {
      console.log(`[Wand:Dataview] Dataview detected, version: ${this.api.version}`);

      // Create a promise that resolves when the index is ready
      this.indexReadyPromise = new Promise((resolve) => {
        this.indexReadyResolve = resolve;
      });

      // Check if already indexed
      // @ts-ignore - internal API
      const indexReady = this.app.metadataCache?.trigger !== undefined;
      if (indexReady) {
        // Listen for index ready event
        this.app.metadataCache.on("dataview:index-ready" as any, () => {
          this.onIndexReady();
        });

        // Also check if it's already ready (might have loaded before us)
        // @ts-ignore - checking internal state
        if (this.api.index?.initialized) {
          this.onIndexReady();
        }
      }
    } else {
      console.log("[Wand:Dataview] Dataview not available");
    }
  }

  private onIndexReady(): void {
    if (!this.indexReady) {
      this.indexReady = true;
      console.log("[Wand:Dataview] Index ready");
      this.indexReadyResolve?.();
    }
  }

  /**
   * Check if Dataview is available and get its status
   */
  getStatus(): DataviewStatus {
    if (!this.api) {
      return { available: false, indexed: false };
    }

    // @ts-ignore - accessing internal API
    const pageCount = this.api.index?.pages?.size;

    return {
      available: true,
      version: this.api.version,
      indexed: this.indexReady,
      pageCount,
    };
  }

  /**
   * Wait for Dataview index to be ready
   */
  async waitForIndex(timeoutMs: number = 10000): Promise<boolean> {
    if (!this.api) return false;
    if (this.indexReady) return true;
    if (!this.indexReadyPromise) return false;

    const timeout = new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    });

    const ready = this.indexReadyPromise.then(() => true);

    return Promise.race([ready, timeout]);
  }

  /**
   * Execute a DQL query and return structured results
   */
  async query(dql: string, originFile?: string): Promise<DataviewQueryResult> {
    if (!this.api) {
      throw new Error("Dataview is not available. Please install the Dataview plugin.");
    }

    await this.waitForIndex();

    const result = await this.api.query(dql, originFile);

    if (!result.successful) {
      throw new Error(`Dataview query failed: ${result.error}`);
    }

    const queryResult = result.value;

    return {
      type: queryResult.type as "list" | "table" | "task" | "calendar",
      values: queryResult.values || [],
      headers: queryResult.type === "table" ? queryResult.headers : undefined,
    };
  }

  /**
   * Get pages matching a source query (tags, folders, links)
   * Examples:
   *   - "#project" - pages with tag
   *   - '"Projects"' - pages in folder
   *   - "[[Index]]" - pages linking to Index
   */
  async pages(source?: string): Promise<PageData[]> {
    if (!this.api) {
      throw new Error("Dataview is not available. Please install the Dataview plugin.");
    }

    await this.waitForIndex();

    const dvPages = this.api.pages(source);
    const results: PageData[] = [];

    for (const page of dvPages) {
      results.push(this.convertPage(page));
    }

    return results;
  }

  /**
   * Get pages matching a source and filter them with a predicate
   */
  async pagesWhere(
    source: string | undefined,
    predicate: (page: PageData) => boolean
  ): Promise<PageData[]> {
    const allPages = await this.pages(source);
    return allPages.filter(predicate);
  }

  /**
   * Get pages with a specific frontmatter field value
   */
  async pagesByField(
    fieldName: string,
    fieldValue: any,
    source?: string
  ): Promise<PageData[]> {
    if (!this.api) {
      throw new Error("Dataview is not available. Please install the Dataview plugin.");
    }

    await this.waitForIndex();

    const dvPages = this.api.pages(source);
    const results: PageData[] = [];

    for (const page of dvPages) {
      const value = page[fieldName];
      if (value === fieldValue || (Array.isArray(value) && value.includes(fieldValue))) {
        results.push(this.convertPage(page));
      }
    }

    return results;
  }

  /**
   * Get all tasks matching criteria
   */
  async tasks(options?: {
    completed?: boolean;
    source?: string;
    tags?: string[];
    dueBefore?: Date;
    dueAfter?: Date;
  }): Promise<TaskData[]> {
    if (!this.api) {
      throw new Error("Dataview is not available. Please install the Dataview plugin.");
    }

    await this.waitForIndex();

    // Use DQL to query tasks
    let dql = "TASK";
    const conditions: string[] = [];

    if (options?.source) {
      dql += ` FROM ${options.source}`;
    }

    if (options?.completed !== undefined) {
      conditions.push(options.completed ? "completed" : "!completed");
    }

    if (options?.tags && options.tags.length > 0) {
      const tagConditions = options.tags.map((t) => `contains(tags, "${t}")`);
      conditions.push(`(${tagConditions.join(" OR ")})`);
    }

    if (options?.dueBefore) {
      conditions.push(`due < date("${options.dueBefore.toISOString().split("T")[0]}")`);
    }

    if (options?.dueAfter) {
      conditions.push(`due > date("${options.dueAfter.toISOString().split("T")[0]}")`);
    }

    if (conditions.length > 0) {
      dql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const result = await this.query(dql);

    return result.values.map((task: any) => ({
      text: task.text || "",
      completed: task.completed || false,
      line: task.line || 0,
      path: task.path || "",
      tags: task.tags || [],
      due: task.due ? new Date(task.due) : undefined,
    }));
  }

  /**
   * Get file paths matching a source query
   */
  async filePaths(source?: string): Promise<string[]> {
    if (!this.api) {
      throw new Error("Dataview is not available. Please install the Dataview plugin.");
    }

    await this.waitForIndex();

    const paths = this.api.pagePaths(source);
    return paths.values;
  }

  /**
   * Get metadata for a single file
   */
  async getPage(path: string): Promise<PageData | null> {
    if (!this.api) {
      throw new Error("Dataview is not available. Please install the Dataview plugin.");
    }

    await this.waitForIndex();

    const page = this.api.page(path);
    if (!page) return null;

    return this.convertPage(page);
  }

  /**
   * Convert a Dataview page object to our PageData type
   */
  private convertPage(dvPage: any): PageData {
    const file = dvPage.file;

    return {
      path: file?.path || "",
      name: file?.name || "",
      tags: file?.tags || [],
      aliases: file?.aliases || [],
      frontmatter: file?.frontmatter || {},
      links: {
        inlinks: (file?.inlinks || []).map((l: any) => l.path || String(l)),
        outlinks: (file?.outlinks || []).map((l: any) => l.path || String(l)),
      },
      tasks: (file?.tasks || []).map((t: any) => ({
        text: t.text || "",
        completed: t.completed || false,
        line: t.line || 0,
        path: file?.path || "",
        tags: t.tags || [],
        due: t.due ? new Date(t.due) : undefined,
      })),
      created: file?.ctime ? new Date(file.ctime) : null,
      modified: file?.mtime ? new Date(file.mtime) : null,
    };
  }

  /**
   * Convert TFile array to file paths for tools that need just paths
   */
  filePathsFromPages(pages: PageData[]): string[] {
    return pages.map((p) => p.path);
  }

  /**
   * Get TFile objects from PageData for vault operations
   */
  getTFiles(pages: PageData[]): TFile[] {
    const files: TFile[] = [];
    for (const page of pages) {
      const file = this.app.vault.getAbstractFileByPath(page.path);
      if (file instanceof TFile) {
        files.push(file);
      }
    }
    return files;
  }

  /**
   * Check if Dataview is installed and enabled
   */
  isAvailable(): boolean {
    return this.api !== undefined;
  }
}
