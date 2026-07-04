import path from 'path';
const WORK_DIR = path.resolve(process.cwd())

export const  CONFIG = {
  agentMaxSteps: 100, // 智能体允许的最大步数
  backgroundWarmupMs:8000, // 后台进程预热时间
  backgroundLogPreviewLines: 50, // task_logs 返回的最大长度
}

// 存储所有的后台拉起的子进程的 pid
export const backgroundProcess = new Map()

function isDescendantOrSameDirectory(candidatePath) {
  const targetAbs = path.resolve(candidatePath)
  const relative = path.relative(WORK_DIR, targetAbs)
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  )
}

// 工作区内解析路径并校验是否越界
function resolvePathInsideWorkDir(relativePath) {
  const candidatePath = path.resolve(WORK_DIR, relativePath)
  if (!isDescendantOrSameDirectory(candidatePath)) {
    throw new Error(`Candidate path ${ relativePath }`)
  }
  return candidatePath
}

export {
  resolvePathInsideWorkDir,
  isDescendantOrSameDirectory,
  WORK_DIR
}
