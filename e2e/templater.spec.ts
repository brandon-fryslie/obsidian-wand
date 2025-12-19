import { test, expect, Browser, Page } from '@playwright/test';
import { launchObsidian, closeObsidian, getObsidianPage } from './helpers/obsidian-launcher';
import { installAndEnablePlugin, uninstallPlugin, PLUGINS } from './fixtures/plugin-installer';
import { ChildProcess } from 'child_process';

/**
 * E2E Tests for Templater Integration
 *
 * These tests validate the Templater tools work correctly in the actual Obsidian environment.
 * Each test covers a specific Templater tool:
 * - templater.status: Check availability
 * - templater.run: Execute template without inserting
 * - templater.insert: Execute and insert at cursor
 * - templater.create: Create new note from template
 *
 * Prerequisites:
 * 1. Wand plugin will be built and installed once at the start of the suite
 * 2. Templater plugin will be installed once at the start of the suite
 * 3. Templates folder must exist with test templates
 */

// Shared test context
let browser: Browser;
let obsidianProcess: ChildProcess;
let page: Page;

const VAULT_PATH = process.env.OBSIDIAN_TEST_VAULT || '~/obsidian-test-vault';
const REQUIRED_PLUGINS = ['wand', 'templater'];

/**
 * Helper to execute a tool via the plugin's internal API
 * This evaluates JavaScript in Obsidian's context to call the ToolsLayer directly
 */
async function executeTool(page: Page, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return await page.evaluate(async ({ toolName, args }) => {
    // Access the plugin instance from Obsidian's app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).app;
    const plugin = app.plugins.plugins['wand'];

    if (!plugin) {
      throw new Error('Wand plugin not found. Is it installed and enabled?');
    }

    // Access the ToolsLayer from the plugin
    const toolsLayer = plugin.toolsLayer;

    if (!toolsLayer) {
      throw new Error('ToolsLayer not available on plugin');
    }

    // Execute the tool
    const result = await toolsLayer.executeTool(toolName, args, {
      riskLevel: 'low',
      planId: 'e2e-test'
    });

    return result;
  }, { toolName, args });
}

/**
 * Helper to create a test template file in the vault
 */
async function createTestTemplate(page: Page, path: string, content: string): Promise<void> {
  await page.evaluate(async ({ path, content }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).app;

    // Ensure parent folder exists
    const folderPath = path.substring(0, path.lastIndexOf('/'));
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    // Create or update the file
    const existingFile = app.vault.getAbstractFileByPath(path);
    if (existingFile) {
      await app.vault.modify(existingFile, content);
    } else {
      await app.vault.create(path, content);
    }
  }, { path, content });
}

/**
 * Helper to delete a file from the vault (cleanup)
 */
async function deleteFile(page: Page, path: string): Promise<void> {
  await page.evaluate(async ({ path }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);
    if (file) {
      await app.vault.delete(file);
    }
  }, { path });
}

/**
 * Helper to check if a file exists in the vault
 */
async function fileExists(page: Page, path: string): Promise<boolean> {
  return await page.evaluate(async ({ path }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);
    return file !== null;
  }, { path });
}

/**
 * Helper to read file content from the vault
 */
async function readFile(page: Page, path: string): Promise<string | null> {
  return await page.evaluate(async ({ path }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);
    if (!file || !('extension' in file)) return null;
    return await app.vault.read(file);
  }, { path });
}

test.describe('Templater Integration E2E Tests', () => {
  // Setup: Install Wand and Templater plugins and launch Obsidian once for all tests in this suite
  test.beforeAll(async () => {
    // Install plugins ONCE (Wand will be built from source, Templater downloaded)
    for (const pluginKey of REQUIRED_PLUGINS) {
      await installAndEnablePlugin(pluginKey, VAULT_PATH);
    }

    // Launch Obsidian ONCE
    const instance = await launchObsidian(VAULT_PATH);
    browser = instance.browser;
    obsidianProcess = instance.process;
    page = getObsidianPage(browser);

    // Wait for Obsidian workspace to be ready
    await page.waitForSelector('.workspace', { timeout: 15000 });
    console.log('[Templater E2E] Obsidian workspace ready');

    // Give plugins time to load
    await page.waitForTimeout(2000);
  });

  // Cleanup: Close Obsidian and uninstall plugins after all tests
  test.afterAll(async () => {
    await closeObsidian(browser, obsidianProcess);

    for (const pluginKey of REQUIRED_PLUGINS) {
      const pluginId = PLUGINS[pluginKey].id;
      await uninstallPlugin(pluginId, VAULT_PATH);
    }
  });

  test.describe('templater.status', () => {
    test('returns availability status', async () => {
      // Execute the status tool
      const result = await executeTool(page, 'templater.status') as {
        available: boolean;
        enabled: boolean;
        templatesFolder?: string;
      };

      console.log('[Templater E2E] templater.status result:', result);

      // Verify Templater is installed and enabled
      expect(result.available).toBe(true);
      expect(result.enabled).toBe(true);
      // templatesFolder might be undefined if not configured
      if (result.templatesFolder) {
        expect(typeof result.templatesFolder).toBe('string');
      }

      // Take screenshot for debugging
      await page.screenshot({ path: 'e2e/test-results/templater-status.png' });
    });
  });

  test.describe('templater.run', () => {
    const testTemplatePath = 'Templates/e2e-test-template.md';
    const testTemplateContent = `# Test Template

Created: <% tp.date.now("YYYY-MM-DD") %>
Title: <% tp.file.title %>

This is a test template for E2E testing.
`;

    test.beforeEach(async () => {
      // Create a test template before each test
      await createTestTemplate(page, testTemplatePath, testTemplateContent);
    });

    test.afterEach(async () => {
      // Clean up test template
      await deleteFile(page, testTemplatePath);
    });

    test('executes template and returns processed content', async () => {
      const result = await executeTool(page, 'templater.run', {
        templatePath: testTemplatePath
      }) as {
        content: string;
        available: boolean;
      };

      console.log('[Templater E2E] templater.run result:', result);

      expect(result.available).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      // The template header should be present
      expect(result.content).toContain('# Test Template');
    });

    test('handles non-existent template path gracefully', async () => {
      // When Templater is installed, expect an error for missing template
      await expect(async () => {
        await executeTool(page, 'templater.run', {
          templatePath: 'NonExistent/Template.md'
        });
      }).rejects.toThrow(/not found/i);
    });

    test('can use targetFile for context', async () => {
      // Create a context file
      const contextPath = 'Notes/test-context-note.md';
      await createTestTemplate(page, contextPath, '# Context Note\n\nSome content.');

      try {
        const result = await executeTool(page, 'templater.run', {
          templatePath: testTemplatePath,
          targetFile: contextPath
        }) as { content: string; available: boolean };

        expect(result.available).toBe(true);
        expect(result.content).toBeDefined();
      } finally {
        await deleteFile(page, contextPath);
      }
    });
  });

  test.describe('templater.insert', () => {
    const testTemplatePath = 'Templates/e2e-insert-template.md';
    const testTemplateContent = `**Inserted Content**
Date: <% tp.date.now("YYYY-MM-DD") %>
`;
    const testNotePath = 'Notes/e2e-insert-test.md';

    test.beforeEach(async () => {
      // Create test template
      await createTestTemplate(page, testTemplatePath, testTemplateContent);
      // Create a note to insert into
      await createTestTemplate(page, testNotePath, '# Test Note\n\nCursor will be here:\n\n');
    });

    test.afterEach(async () => {
      await deleteFile(page, testTemplatePath);
      await deleteFile(page, testNotePath);
    });

    test('returns error when no active editor', async () => {
      // This test verifies the tool handles missing editor gracefully
      // First, close all editors to ensure no active editor
      await page.keyboard.press('Meta+w'); // Close current tab
      await page.waitForTimeout(500);

      // When Templater is installed but no editor, expect error
      await expect(async () => {
        await executeTool(page, 'templater.insert', {
          templatePath: testTemplatePath
        });
      }).rejects.toThrow(/editor|active/i);
    });

    test('inserts template at cursor position when editor is active', async () => {
      // Open the test note
      await page.evaluate(async ({ path }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = (window as any).app;
        const file = app.vault.getAbstractFileByPath(path);
        if (file) {
          await app.workspace.getLeaf().openFile(file);
        }
      }, { path: testNotePath });

      // Wait for editor to be ready
      await page.waitForSelector('.cm-editor', { timeout: 5000 });
      await page.waitForTimeout(500);

      // Move cursor to end of file
      await page.keyboard.press('Meta+End');

      // Execute the insert
      const result = await executeTool(page, 'templater.insert', {
        templatePath: testTemplatePath
      }) as {
        success: boolean;
        content: string;
        available: boolean;
      };

      console.log('[Templater E2E] templater.insert result:', result);

      expect(result.available).toBe(true);
      expect(result.success).toBe(true);
      expect(result.content).toContain('Inserted Content');

      // Verify the content was actually inserted
      const fileContent = await readFile(page, testNotePath);
      expect(fileContent).toContain('**Inserted Content**');
    });
  });

  test.describe('templater.create', () => {
    const testTemplatePath = 'Templates/e2e-create-template.md';
    const testTemplateContent = `# New Note from Template

Created: <% tp.date.now("YYYY-MM-DD HH:mm") %>
Type: E2E Test

## Content
This note was created from a template.
`;
    const outputPath = 'Generated/e2e-created-note.md';

    test.beforeEach(async () => {
      // Create test template
      await createTestTemplate(page, testTemplatePath, testTemplateContent);
      // Ensure output file doesn't exist
      await deleteFile(page, outputPath);
    });

    test.afterEach(async () => {
      await deleteFile(page, testTemplatePath);
      await deleteFile(page, outputPath);
      // Clean up Generated folder if empty
      await page.evaluate(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const app = (window as any).app;
        const folder = app.vault.getAbstractFileByPath('Generated');
        if (folder) {
          try {
            await app.vault.delete(folder);
          } catch {
            // Folder might not be empty
          }
        }
      });
    });

    test('creates new note from template', async () => {
      const result = await executeTool(page, 'templater.create', {
        templatePath: testTemplatePath,
        outputPath: outputPath,
        openNote: false
      }) as {
        path: string;
        created: boolean;
        available: boolean;
      };

      console.log('[Templater E2E] templater.create result:', result);

      expect(result.available).toBe(true);
      expect(result.created).toBe(true);
      expect(result.path).toBe(outputPath);

      // Verify file was actually created
      const exists = await fileExists(page, outputPath);
      expect(exists).toBe(true);

      // Verify content
      const content = await readFile(page, outputPath);
      expect(content).toContain('# New Note from Template');
      expect(content).toContain('Type: E2E Test');
    });

    test('creates note with folderPath override', async () => {
      const customFolder = 'CustomFolder';
      const customOutputPath = `${customFolder}/custom-note.md`;

      try {
        const result = await executeTool(page, 'templater.create', {
          templatePath: testTemplatePath,
          outputPath: 'some-note.md',
          folderPath: customFolder
        }) as {
          path: string;
          created: boolean;
          available: boolean;
        };

        expect(result.available).toBe(true);
        expect(result.created).toBe(true);
        // The path should be in the custom folder
        expect(result.path.startsWith(customFolder)).toBe(true);
      } finally {
        // Clean up
        await page.evaluate(async ({ folder }) => {
          // @ts-expect-error - accessing internal Obsidian API
          const app = window.app;
          const folderObj = app.vault.getAbstractFileByPath(folder);
          if (folderObj) {
            await app.vault.delete(folderObj, true);
          }
        }, { folder: customFolder });
      }
    });

    test('handles template not found error', async () => {
      // When Templater is installed, should throw error for missing template
      await expect(async () => {
        await executeTool(page, 'templater.create', {
          templatePath: 'NonExistent/Template.md',
          outputPath: outputPath
        });
      }).rejects.toThrow(/not found/i);
    });
  });
});
