import {
  isSafePath,
  validateVaultPath,
  ensureExtension,
  ensureMarkdownExtension,
  getParentPath,
  joinPath,
  getFilename,
  getBasename,
  getExtension,
} from "../../src/utils/pathValidation";

describe("pathValidation", () => {
  describe("isSafePath", () => {
    it("should accept safe relative paths", () => {
      expect(isSafePath("folder/file.md")).toBe(true);
      expect(isSafePath("notes/daily/2024.md")).toBe(true);
      expect(isSafePath("file.txt")).toBe(true);
    });

    it("should reject paths with parent directory references", () => {
      expect(isSafePath("../etc/passwd")).toBe(false);
      expect(isSafePath("folder/../secret.md")).toBe(false);
      expect(isSafePath("../../")).toBe(false);
    });

    it("should reject absolute paths", () => {
      expect(isSafePath("/etc/passwd")).toBe(false);
      expect(isSafePath("C:\\Windows\\System32")).toBe(false);
      expect(isSafePath("D:\\data")).toBe(false);
    });

    it("should handle edge cases", () => {
      expect(isSafePath("")).toBe(true); // Empty path is safe but might not be useful
      expect(isSafePath("file..name.md")).toBe(false); // Contains ..
      expect(isSafePath("regular.file.md")).toBe(true); // Multiple dots OK
    });
  });

  describe("validateVaultPath", () => {
    it("should validate and normalize safe paths", () => {
      expect(validateVaultPath("folder/file.md")).toBe("folder/file.md");
      expect(validateVaultPath("notes\\daily\\2024.md")).toBe("notes/daily/2024.md");
    });

    it("should throw on path traversal attempts", () => {
      expect(() => validateVaultPath("../etc/passwd")).toThrow("Path traversal not allowed");
      expect(() => validateVaultPath("folder/../secret.md")).toThrow("Path traversal not allowed");
    });

    it("should throw on absolute paths", () => {
      expect(() => validateVaultPath("/etc/passwd")).toThrow("Path traversal not allowed");
      expect(() => validateVaultPath("C:\\Windows\\System32")).toThrow("Path traversal not allowed");
    });

    it("should normalize backslashes to forward slashes", () => {
      expect(validateVaultPath("folder\\subfolder\\file.md")).toBe("folder/subfolder/file.md");
      expect(validateVaultPath("mixed/slashes\\path.md")).toBe("mixed/slashes/path.md");
    });
  });

  describe("ensureExtension", () => {
    it("should add extension if missing", () => {
      expect(ensureExtension("file", ".md")).toBe("file.md");
      expect(ensureExtension("file", "md")).toBe("file.md");
    });

    it("should not duplicate extension", () => {
      expect(ensureExtension("file.md", ".md")).toBe("file.md");
      expect(ensureExtension("file.txt", "txt")).toBe("file.txt");
    });

    it("should work with various extensions", () => {
      expect(ensureExtension("doc", ".pdf")).toBe("doc.pdf");
      expect(ensureExtension("image", "png")).toBe("image.png");
    });
  });

  describe("ensureMarkdownExtension", () => {
    it("should add .md extension if missing", () => {
      expect(ensureMarkdownExtension("file")).toBe("file.md");
      expect(ensureMarkdownExtension("notes/daily")).toBe("notes/daily.md");
    });

    it("should not duplicate .md extension", () => {
      expect(ensureMarkdownExtension("file.md")).toBe("file.md");
      expect(ensureMarkdownExtension("notes/daily.md")).toBe("notes/daily.md");
    });

    it("should not affect other extensions", () => {
      expect(ensureMarkdownExtension("file.txt")).toBe("file.txt.md");
    });
  });

  describe("getParentPath", () => {
    it("should return parent directory", () => {
      expect(getParentPath("folder/file.md")).toBe("folder");
      expect(getParentPath("a/b/c/file.md")).toBe("a/b/c");
    });

    it("should return empty string for root level files", () => {
      expect(getParentPath("file.md")).toBe("");
    });

    it("should handle nested folders", () => {
      expect(getParentPath("notes/daily/2024/file.md")).toBe("notes/daily/2024");
    });

    it("should validate path before processing", () => {
      expect(() => getParentPath("../etc/passwd")).toThrow("Path traversal not allowed");
    });
  });

  describe("joinPath", () => {
    it("should join path segments", () => {
      expect(joinPath("folder", "file.md")).toBe("folder/file.md");
      expect(joinPath("a", "b", "c", "file.md")).toBe("a/b/c/file.md");
    });

    it("should handle leading/trailing slashes", () => {
      expect(joinPath("folder/", "file.md")).toBe("folder/file.md");
      expect(joinPath("folder", "/file.md")).toBe("folder/file.md");
    });

    it("should remove duplicate slashes", () => {
      expect(joinPath("folder//", "//file.md")).toBe("folder/file.md");
      expect(joinPath("a///b", "c")).toBe("a/b/c");
    });

    it("should filter out empty segments", () => {
      expect(joinPath("folder", "", "file.md")).toBe("folder/file.md");
      expect(joinPath("", "folder", "", "file.md", "")).toBe("folder/file.md");
    });

    it("should validate result for safety", () => {
      expect(() => joinPath("folder", "..", "etc", "passwd")).toThrow("Path traversal not allowed");
    });
  });

  describe("getFilename", () => {
    it("should extract filename from path", () => {
      expect(getFilename("folder/file.md")).toBe("file.md");
      expect(getFilename("a/b/c/document.txt")).toBe("document.txt");
    });

    it("should return full string for root level files", () => {
      expect(getFilename("file.md")).toBe("file.md");
    });

    it("should handle backslashes", () => {
      expect(getFilename("folder\\file.md")).toBe("file.md");
      expect(getFilename("a\\b\\c.txt")).toBe("c.txt");
    });
  });

  describe("getBasename", () => {
    it("should extract filename without extension", () => {
      expect(getBasename("file.md")).toBe("file");
      expect(getBasename("folder/document.txt")).toBe("document");
    });

    it("should handle multiple dots", () => {
      expect(getBasename("archive.tar.gz")).toBe("archive.tar");
      expect(getBasename("my.file.name.md")).toBe("my.file.name");
    });

    it("should handle files without extension", () => {
      expect(getBasename("README")).toBe("README");
      expect(getBasename("folder/Makefile")).toBe("Makefile");
    });

    it("should handle hidden files", () => {
      expect(getBasename(".gitignore")).toBe("");
      expect(getBasename("folder/.hidden")).toBe("");
    });
  });

  describe("getExtension", () => {
    it("should extract file extension", () => {
      expect(getExtension("file.md")).toBe(".md");
      expect(getExtension("document.txt")).toBe(".txt");
      expect(getExtension("folder/image.png")).toBe(".png");
    });

    it("should return empty string for files without extension", () => {
      expect(getExtension("README")).toBe("");
      expect(getExtension("folder/Makefile")).toBe("");
    });

    it("should handle multiple dots", () => {
      expect(getExtension("archive.tar.gz")).toBe(".gz");
      expect(getExtension("file.backup.txt")).toBe(".txt");
    });

    it("should return empty string for hidden files", () => {
      expect(getExtension(".gitignore")).toBe("");
      expect(getExtension("folder/.hidden")).toBe("");
    });

    it("should handle paths with dots in folder names", () => {
      expect(getExtension("folder.name/file.md")).toBe(".md");
      expect(getExtension("some.folder/README")).toBe("");
    });
  });
});
