import fsp from 'fs/promises';
import { resolvePathInsideWorkDir } from '../utils/index.js';


export class ListDir {
  // 列出一个目录中的内容
  async run({ path: relativePath }) {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath);
      // 目标路径的文件状态
      const stat = await fsp.stat(absolute)
      if (!stat.isDirectory()) {
        return `目标路径不是一个目录:${relativePath}`
      }
      const entries = await fsp.readdir(absolute, {withFileTypes: true}) // 读取目录下所有的条目，并获取类型信息
      // 根据文件名称进行一个字典排序
      entries.sort((a,b) => a.name.localeCompare(b.name))
      const rows = entries.map(entry => `${entry.isDirectory() ? '目录' : '文件'} ${entry.name}`);
      return rows.length > 0?rows.join('\n') : ''
    }catch (err) {
      return '异常：'+err.message;
    }
  }
}

