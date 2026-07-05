import fsp from 'fs/promises';
import { resolvePathInsideWorkDir } from '../utils/index.js';


export class CreateDirectory {
  // 在工作区内递归创建目录；路径边界由 resolvePathInsideWorkDir 校验。
  async run({ path: relativePath }) {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath);
      await fsp.mkdir(absolute, {recursive: true});
      return `已创建目录：${relativePath}`;
    }catch (err) {
      return '创建失败：'+err.message;
    }
  }
}
