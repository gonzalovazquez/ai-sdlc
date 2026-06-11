import { DynamicStructuredTool } from "@langchain/core/tools";
import { LOCAL_FS_TOOLS } from "./fs";
import { githubCreateBranchTool, githubCommitFilesTool, githubCreatePrTool } from "./github";

export function getLocalToolsForAgent(agentName: string): DynamicStructuredTool[] {
  const tools: DynamicStructuredTool[] = [];

  switch (agentName) {
    case "code_agent":
      // The code agent writes files to the workspace. The GitHub push happens
      // deterministically in the node afterwards, not via model tool calls.
      tools.push(...LOCAL_FS_TOOLS);
      break;
    
    case "release_agent":
      // The release agent is responsible for creating pulling requests
      tools.push(githubCreatePrTool);
      break;

    default:
      // Other agents don't receive local tools unless explicitly mapped
      break;
  }

  return tools;
}
