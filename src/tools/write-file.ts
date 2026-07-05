import fsp from 'node:fs/promises'
import path from 'node:path'
import { getErrorMessage, resolvePathInsideWorkDir } from '../utils/index.js'
import type { ToolRunner, WriteFileArgs } from '../types.js'

class WriteText implements ToolRunner<WriteFileArgs> {
  // 写入工作区内文件；父目录不存在时先递归创建。
  async run({ path: relativePath, content }: WriteFileArgs): Promise<string> {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath)
      await fsp.mkdir(path.dirname(absolute), { recursive: true })
      await fsp.writeFile(absolute, content, 'utf-8')
      return `已落盘 ${ Buffer.byteLength(content, 'utf-8') }字节 -> ${ relativePath }`
    } catch (err) {
      return `写入异常：${ getErrorMessage(err) }`
    }
  }
}

export { WriteText }
