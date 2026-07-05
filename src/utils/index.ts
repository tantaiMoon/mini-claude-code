import path from 'node:path'
import type { BackgroundProcessMeta } from '../types.js'

// 工具执行统一以启动进程所在目录作为工作区根目录。
const WORK_DIR = path.resolve(process.cwd())

export const CONFIG = {
  agentMaxSteps: 100, // 智能体允许的最大步数
  backgroundWarmupMs: 8000, // 后台进程预热时间
  backgroundLogPreviewLines: 50 // task_logs 返回的最大长度
}

// 记录 runCommand 拉起的后台子进程，供 task_list/task_logs/task_stop 管理。
export const backgroundProcess = new Map<number, BackgroundProcessMeta>()

// 判断目标路径是否仍位于工作区内，防止通过 ../ 访问工作区外文件。
function isDescendantOrSameDirectory(candidatePath: string): boolean {
  const targetAbs = path.resolve(candidatePath)
  const relative = path.relative(WORK_DIR, targetAbs)
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${ path.sep }`) &&
    !path.isAbsolute(relative)
  )
}

// 将用户传入路径解析为工作区内绝对路径，越界时直接抛错。
function resolvePathInsideWorkDir(relativePath: string): string {
  const candidatePath = path.resolve(WORK_DIR, relativePath)
  if (!isDescendantOrSameDirectory(candidatePath)) {
    throw new Error(`Candidate path ${ relativePath }`)
  }
  return candidatePath
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }

  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

export {
  resolvePathInsideWorkDir,
  isDescendantOrSameDirectory,
  getErrorMessage,
  getErrorCode,
  WORK_DIR
}
