// Jest setup file
import "jest";
import { App } from "obsidian";

// Obsidian is now mocked via moduleNameMapper in jest.config.js

// Mock nanoid
jest.mock("nanoid", () => ({
  nanoid: jest.fn(() => "test-id-12345"),
}));

// Global test utilities
declare global {
  function createMockApp(): App;
  function createMockSettings(): MockSettings;
}

export interface MockSettings {
  llm: {
    provider: "openai" | "anthropic" | "custom";
    apiKey: string;
    customEndpoint: string;
    model: string;
    temperature: number;
    streaming: boolean;
    maxTokens: number;
  };
  safety: {
    confirmWrites: boolean;
    allowCommands: boolean;
    allowDeletes: boolean;
    allowRenames: boolean;
  };
  chat: {
    maxHistory: number;
    showThinking: boolean;
    autoSavePlans: boolean;
  };
  ui: {
    theme: "obsidian" | "light" | "dark";
    fontSize: number;
    showRibbonIcon: boolean;
  };
}

global.createMockApp = (): App => {
  return new App();
};

global.createMockSettings = (): MockSettings => ({
  llm: {
    provider: "openai" as const,
    apiKey: "test-key",
    customEndpoint: "",
    model: "gpt-4",
    temperature: 0.3,
    streaming: true,
    maxTokens: 4000,
  },
  safety: {
    confirmWrites: true,
    allowCommands: true,
    allowDeletes: false,
    allowRenames: false,
  },
  chat: {
    maxHistory: 50,
    showThinking: false,
    autoSavePlans: false,
  },
  ui: {
    theme: "obsidian" as const,
    fontSize: 14,
    showRibbonIcon: true,
  },
});
