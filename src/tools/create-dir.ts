import fsp from 'node:fs/promises'
import { getErrorMessage, resolvePathInsideWorkDir } from '../utils/index.js'
import type { PathToolArgs, ToolRunner } from '../types.js'

export class CreateDirectory implements ToolRunner<PathToolArgs> {
  // 在工作区内递归创建目录；路径边界由 resolvePathInsideWorkDir 校验。
  async run({ path: relativePath }: PathToolArgs): Promise<string> {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath)
      await fsp.mkdir(absolute, { recursive: true })
      return `已创建目录：${ relativePath }`
    } catch (err) {
      return `创建失败：${ getErrorMessage(err) }`
    }
  }
}
