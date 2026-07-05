import fsp from 'fs/promises';
import { resolvePathInsideWorkDir } from '../utils/index.js';


export class ListDir {
  // 列出工作区内目录内容，并标明每个条目是文件还是目录。
  async run({ path: relativePath }) {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath);
      // 先确认目标是目录，避免把文件误当成可遍历对象。
      const stat = await fsp.stat(absolute)
      if (!stat.isDirectory()) {
        return `目标路径不是一个目录:${relativePath}`
      }
      // withFileTypes 直接返回类型信息，避免逐个 stat。
      const entries = await fsp.readdir(absolute, {withFileTypes: true})
      // 按名称排序，确保多次读取的输出稳定。
      entries.sort((a,b) => a.name.localeCompare(b.name))
      const rows = entries.map(entry => `${entry.isDirectory() ? '目录' : '文件'} ${entry.name}`);
      return rows.length > 0?rows.join('\n') : ''
    }catch (err) {
      return '异常：'+err.message;
    }
  }
}
