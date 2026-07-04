import fsp from 'fs/promises';
import { resolvePathInsideWorkDir } from '../utils/index.js';


class ReadText {
  // 读取文件路径指定的内容
  async run({ path: relativePath }) {
    try {
      return await fsp.readFile(resolvePathInsideWorkDir(relativePath), 'utf-8');
    }catch (err) {
      return err.code === 'ENOENT' ? `not found: ${relativePath}` : '读取异常：'+err.message;
    }
  }
}

export { ReadText }
