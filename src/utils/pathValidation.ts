/**
 * Path validation utilities for secure vault operations
 * Prevents path traversal attacks and ensures paths stay within vault
 */

/**
 * Checks if a path contains path traversal patterns
 * @param path - The path to validate
 * @returns true if path is safe, false if it contains traversal attempts
 */
export function isSafePath(path: string): boolean {
  // Reject paths with parent directory references
  if (path.includes("..")) {
    return false;
  }

  // Reject absolute paths (should be vault-relative)
  if (path.startsWith("/") || /^[A-Za-z]:/.test(path)) {
    return false;
  }

  return true;
}

/**
 * Validates and normalizes a vault path
 * @param path - The path to validate
 * @throws Error if path contains traversal attempts or is absolute
 * @returns Normalized path with forward slashes
 */
export function validateVaultPath(path: string): string {
  if (!isSafePath(path)) {
    throw new Error("Path traversal not allowed");
  }

  // Normalize to forward slashes
  return path.replace(/\\/g, "/");
}

/**
 * Ensures a path has a specific extension
 * @param path - The path to check
 * @param extension - The extension to add (with or without leading dot)
 * @returns Path with the extension
 */
export function ensureExtension(path: string, extension: string): string {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return path.endsWith(ext) ? path : `${path}${ext}`;
}

/**
 * Ensures a path ends with .md extension
 * @param path - The path to check
 * @returns Path with .md extension
 */
export function ensureMarkdownExtension(path: string): string {
  return ensureExtension(path, ".md");
}

/**
 * Gets the parent directory path
 * @param path - The file/folder path
 * @returns Parent directory path, or empty string if at root
 */
export function getParentPath(path: string): string {
  const normalized = validateVaultPath(path);
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash === -1) {
    return "";
  }

  return normalized.substring(0, lastSlash);
}

/**
 * Joins path segments safely
 * @param segments - Path segments to join
 * @returns Joined and validated path
 */
export function joinPath(...segments: string[]): string {
  const joined = segments
    .filter((seg) => seg.length > 0)
    .join("/")
    .replace(/\/+/g, "/"); // Remove duplicate slashes

  return validateVaultPath(joined);
}

/**
 * Gets the filename from a path (last segment)
 * @param path - The file path
 * @returns Filename
 */
export function getFilename(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");

  if (lastSlash === -1) {
    return normalized;
  }

  return normalized.substring(lastSlash + 1);
}

/**
 * Gets the filename without extension
 * @param path - The file path
 * @returns Filename without extension
 */
export function getBasename(path: string): string {
  const filename = getFilename(path);
  const lastDot = filename.lastIndexOf(".");

  if (lastDot === -1) {
    return filename;
  }

  return filename.substring(0, lastDot);
}

/**
 * Gets the file extension (including the dot)
 * @param path - The file path
 * @returns Extension with dot, or empty string if no extension
 */
export function getExtension(path: string): string {
  const filename = getFilename(path);
  const lastDot = filename.lastIndexOf(".");

  if (lastDot === -1 || lastDot === 0) {
    return "";
  }

  return filename.substring(lastDot);
}
