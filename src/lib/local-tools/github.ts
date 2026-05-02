import { DynamicStructuredTool } from "@langchain/core/tools";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { logger } from "../logger";

const log = logger.child({ module: "mcp-local-github" });

// Lazy-load Octokit client based on environment variables
let _octokit: Octokit | null = null;

function getOctokit(): Octokit {
  if (_octokit) return _octokit;
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not defined in the environment.");
  }
  _octokit = new Octokit({ auth: token });
  return _octokit;
}

function getRepoConfig() {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER or GITHUB_REPO are not defined in the environment.");
  }
  return { owner, repo };
}

export const githubCreateBranchTool = new DynamicStructuredTool({
  name: "github_create_branch",
  description: "Create a new Git branch in the remote GitHub repository.",
  schema: z.object({
    branchName: z.string().describe("Name of the branch to create."), // Note: exclude refs/heads prefix
    baseBranch: z.string().default("main").describe("Optional base branch name (e.g., 'main') to fork from."),
  }),
  func: async ({ branchName, baseBranch }) => {
    try {
      const octokit = getOctokit();
      const { owner, repo } = getRepoConfig();
      
      const cleanBranch = branchName.replace(/^refs\/heads\//, "");
      
      // Get base reference SHA
      const baseRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
      });
      
      // Create new branch
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${cleanBranch}`,
        sha: baseRef.data.object.sha,
      });

      log.info({ branch: cleanBranch }, "Created GitHub branch via local tool");
      return `Successfully created branch refs/heads/${cleanBranch}`;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ branch: branchName, err: errMsg }, "Failed to create branch");
      return `Error creating branch: ${errMsg}`;
    }
  },
});

export const githubCommitFilesTool = new DynamicStructuredTool({
  name: "github_commit_files",
  description: "Commit multiple files directly to a specific branch in the remote GitHub repository.",
  schema: z.object({
    branchName: z.string().describe("Branch to commit to."),
    commitMessage: z.string().describe("Conventional commit message."),
    files: z.array(z.object({
      path: z.string().describe("Repo-relative path (e.g., 'src/index.ts')."),
      content: z.string().describe("File content string."),
    })).describe("List of files to commit."),
  }),
  func: async ({ branchName, commitMessage, files }) => {
    try {
      const octokit = getOctokit();
      const { owner, repo } = getRepoConfig();
      const cleanBranch = branchName.replace(/^refs\/heads\//, "");

      // 1. Get current branch reference
      const refResponse = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${cleanBranch}`,
      });
      const latestCommitSha = refResponse.data.object.sha;

      // 2. Get tree of the current commit
      const commitResponse = await octokit.rest.git.getCommit({
        owner,
        repo,
        commit_sha: latestCommitSha,
      });
      const baseTreeSha = commitResponse.data.tree.sha;

      // 3. Create a blob for each file and build a tree struct
      const newTreeItems = await Promise.all(
        files.map(async (file) => {
          const blobResponse = await octokit.rest.git.createBlob({
            owner,
            repo,
            content: file.content,
            encoding: "utf-8",
          });
          return {
            path: file.path,
            mode: "100644" as const, // standard file mode
            type: "blob" as const,
            sha: blobResponse.data.sha,
          };
        })
      );

      // 4. Create new tree
      const newTreeResponse = await octokit.rest.git.createTree({
        owner,
        repo,
        base_tree: baseTreeSha,
        tree: newTreeItems,
      });
      
      // 5. Create the new commit
      const newCommitResponse = await octokit.rest.git.createCommit({
        owner,
        repo,
        message: commitMessage,
        tree: newTreeResponse.data.sha,
        parents: [latestCommitSha],
      });

      // 6. Update reference
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${cleanBranch}`,
        sha: newCommitResponse.data.sha,
      });

      log.info({ branch: cleanBranch, fileCount: files.length }, "Committed files to GitHub");
      return `Successfully created commit ${newCommitResponse.data.sha} on branch ${cleanBranch}`;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ branch: branchName, err: errMsg }, "Failed to commit files to GitHub");
      return `Error committing to GitHub: ${errMsg}`;
    }
  },
});

export const githubCreatePrTool = new DynamicStructuredTool({
  name: "github_create_pr",
  description: "Create a Pull Request in GitHub from a feature branch to the base branch.",
  schema: z.object({
    headBranch: z.string().describe("The feature branch containing the changes."),
    baseBranch: z.string().default("main").describe("The branch you want your changes pulled into (e.g., 'main')."),
    title: z.string().describe("Title of the PR."),
    body: z.string().describe("Markdown content for the PR body descriptions."),
  }),
  func: async ({ headBranch, baseBranch, title, body }) => {
    try {
      const octokit = getOctokit();
      const { owner, repo } = getRepoConfig();
      const cleanHead = headBranch.replace(/^refs\/heads\//, "");
      
      const prResponse = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        head: cleanHead,
        base: baseBranch,
        body,
      });
      
      log.info({ prNumber: prResponse.data.number, branch: cleanHead }, "Created PR on GitHub");
      return `Successfully created Pull Request #${prResponse.data.number}: ${prResponse.data.html_url}`;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error({ branch: headBranch, err: errMsg }, "Failed to create PR");
      return `Error creating PR: ${errMsg}`;
    }
  },
});

export const LOCAL_GITHUB_TOOLS = [
  githubCreateBranchTool,
  githubCommitFilesTool,
  githubCreatePrTool,
];
