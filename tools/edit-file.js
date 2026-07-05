import fsp from 'fs/promises';
import { resolvePathInsideWorkDir } from '../utils/index.js';


export class EditFile {
  // 对工作区内文件做一次精确文本替换，适合小范围补丁式编辑。
  async run({ path: relativePath, oldText, content }) {
    try {
      const absolute = resolvePathInsideWorkDir(relativePath);
      const before = await fsp.readFile(absolute, 'utf-8');
      // oldText 必须完整存在，否则拒绝写入，降低误替换风险。
      if (!before.includes(oldText)) return `文件中没有要修改的内容`
      await fsp.writeFile(absolute, before.replace(oldText, content), 'utf-8');
      return `已修改文件：${relativePath}`;
    }catch (err) {
      return '写入异常：'+err.message;
    }
  }
}
