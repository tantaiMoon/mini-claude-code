import fsp from 'fs/promises';
import path from 'path';
import { resolvePathInsideWorkDir } from '../utils/index.js';


class WriteText {
  // 读取文件路径指定的内容
  async run({ path: relativePath, content }) {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath);
      await fsp.mkdir(path.dirname(absolute), {recursive: true});
      await fsp.writeFile(absolute, content, 'utf-8');
      return `已落盘 ${Buffer.byteLength(content, 'utf-8')}字节 -> ${relativePath}`;
    }catch (err) {
      return '写入异常：'+err.message;
    }
  }
}

export { WriteText };
