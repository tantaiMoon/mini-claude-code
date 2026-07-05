import fsp from 'node:fs/promises'
import { getErrorCode, getErrorMessage, resolvePathInsideWorkDir } from '../utils/index.js'
import type { PathToolArgs, ToolRunner } from '../types.js'

class ReadText implements ToolRunner<PathToolArgs> {
  // 读取工作区内的文本文件；路径越界会由 resolvePathInsideWorkDir 拦截。
  async run({ path: relativePath }: PathToolArgs): Promise<string> {
    try {
      return await fsp.readFile(resolvePathInsideWorkDir(relativePath), 'utf-8')
    } catch (err) {
      return getErrorCode(err) === 'ENOENT' ? `not found: ${ relativePath }` : `读取异常：${ getErrorMessage(err) }`
    }
  }
}

export { ReadText }
