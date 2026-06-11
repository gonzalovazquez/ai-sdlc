import * as fs from "node:fs/promises";
import * as path from "node:path";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { logger } from "../logger";

const log = logger.child({ module: "mcp-local-fs" });

// Generated code is confined to a workspace directory. It must NOT default to
// the app's own root: generated files like app/page.tsx would be picked up by
// the running Next.js dev server and break its routing.
export const WORKSPACE_DIR = path.resolve(
  process.env.WORKSPACE_DIR ?? path.join(process.cwd(), "workspace")
);

function resolveSafePath(userPath: string): string {
  const resolved = path.resolve(WORKSPACE_DIR, userPath);
  if (!resolved.startsWith(WORKSPACE_DIR)) {
    throw new Error(`Path ${userPath} attempts to escape workspace boundaries.`);
  }
  return resolved;
}

export const fsReadFileTool = new DynamicStructuredTool({
  name: "fs_read_file",
  description: "Read the contents of a local file.",
  schema: z.object({
    filePath: z.string().describe("Relative or absolute path to the file to read within the workspace."),
  }),
  func: async ({ filePath }) => {
    try {
      const safePath = resolveSafePath(filePath);
      const content = await fs.readFile(safePath, "utf-8");
      log.info({ filePath: safePath }, "Read file via local tool");
      return content;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ filePath, err: errMsg }, "Failed to read file");
      return `Error reading file: ${errMsg}`;
    }
  },
});

export const fsWriteFileTool = new DynamicStructuredTool({
  name: "fs_write_file",
  description: "Write or overwrite a file at a specific local path. Parent directories will be automatically created.",
  schema: z.object({
    filePath: z.string().describe("Path to the file to create or overwrite."),
    content: z.string().describe("The full string content to write to the file."),
  }),
  func: async ({ filePath, content }) => {
    try {
      const safePath = resolveSafePath(filePath);
      await fs.mkdir(path.dirname(safePath), { recursive: true });
      await fs.writeFile(safePath, content, "utf-8");
      log.info({ filePath: safePath }, "Wrote file via local tool");
      return `Successfully wrote file to ${filePath}`;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ filePath, err: errMsg }, "Failed to write file");
      return `Error writing file: ${errMsg}`;
    }
  },
});

export const fsListDirTool = new DynamicStructuredTool({
  name: "fs_list_dir",
  description: "List the names of all files and directories inside a local directory.",
  schema: z.object({
    dirPath: z.string().default(".").describe("Path to the directory to list."),
  }),
  func: async ({ dirPath }) => {
    try {
      const safePath = resolveSafePath(dirPath);
      const entries = await fs.readdir(safePath, { withFileTypes: true });
      const listing = entries.map((e) => `${e.name}${e.isDirectory() ? "/" : ""}`).join("\n");
      log.info({ dirPath: safePath, entryCount: entries.length }, "Listed directory via local tool");
      return listing || "Directory is empty";
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ dirPath, err: errMsg }, "Failed to list directory");
      return `Error listing directory: ${errMsg}`;
    }
  },
});

export const fsMkdirTool = new DynamicStructuredTool({
  name: "fs_mkdir",
  description: "Create a directory on the local filesystem. Creates parent directories recursively if needed.",
  schema: z.object({
    dirPath: z.string().describe("Path of the directory to create."),
  }),
  func: async ({ dirPath }) => {
    try {
      const safePath = resolveSafePath(dirPath);
      await fs.mkdir(safePath, { recursive: true });
      log.info({ dirPath: safePath }, "Created directory via local tool");
      return `Successfully created directory: ${dirPath}`;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ dirPath, err: errMsg }, "Failed to create directory");
      return `Error creating directory: ${errMsg}`;
    }
  },
});

export const LOCAL_FS_TOOLS = [
  fsReadFileTool,
  fsWriteFileTool,
  fsListDirTool,
  fsMkdirTool,
];
