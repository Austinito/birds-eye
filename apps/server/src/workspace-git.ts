import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT_MS = 1500
const GIT_MAX_BUFFER_BYTES = 128 * 1024

export interface WorkspaceGitInfo {
  isRepo: boolean
  branch?: string
  detachedHead?: string
  rootPath?: string
}

async function runGit(args: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT_MS,
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    })

    const value = stdout.trim()
    return value || null
  } catch {
    return null
  }
}

export async function getWorkspaceGitInfo(workspacePath: string): Promise<WorkspaceGitInfo | undefined> {
  const rootPath = await runGit(['rev-parse', '--show-toplevel'], workspacePath)
  if (!rootPath) {
    return { isRepo: false }
  }

  const branch = await runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], workspacePath)
  if (branch) {
    return {
      isRepo: true,
      branch,
      rootPath,
    }
  }

  const detachedHead = await runGit(['rev-parse', '--short', 'HEAD'], workspacePath)

  return {
    isRepo: true,
    detachedHead: detachedHead ?? undefined,
    rootPath,
  }
}
