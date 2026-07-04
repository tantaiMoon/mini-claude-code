import fsp from 'fs/promises';
import { resolvePathInsideWorkDir } from '../utils/index.js';


export class EditFile {
  // 编辑文件路径指定的内容
  async run({ path: relativePath, oldText, content }) {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath);
      const before = await fsp.readFile(absolute, 'utf-8');
      // 检查原来的内容是否包含被替换的内容，如果没有就提示
      if (!before.includes(oldText)) return `文件中没有要修改的内容`
      await fsp.writeFile(absolute, before.replace(oldText, content), 'utf-8');
      return `已修改文件：${relativePath}`;
    }catch (err) {
      return '写入异常：'+err.message;
    }
  }
}

