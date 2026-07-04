import { ReadText } from './read-file.js';
import { WriteText } from './write-file.js';
import { EditFile } from './edit-file.js';
import { ListDir } from './list-dir.js';
import { CreateDirectory } from './create-dir.js';
import { RunCommand } from './run-command.js'

// 工具的 Schema，描述每个工具的用途和参数结构

const MODEL_TOOL_DEFINATIONS = [
  {
    type: 'function',
    function: {
      name: 'createDirectory',
      description: '在工作区内递归创建一个文件夹',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '文件夹路径或名称' } },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readFile',
      description: '以 utf8 编码格式读取工作区内的文本文件',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '文件路径' } },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'writeFile',
      description: '在工作区内新建或者写入指定的文件',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          content: { type: 'string', description: '要写入的文件内容' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editFile',
      description: '在工作区内对已有的文件进行一次精确的替换，oldText 必须与文件内容完全一致',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '文件路径' },
          oldText: { type: 'string', description: '要被替换的内容（唯一一次匹配）' },
          content: { type: 'string', description: '替换后的新内容' }
        },
        required: ['path', 'oldText', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listDir',
      description: '罗列目录下的条目（包含文件夹标识），用于快速摸清文件夹内容',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '目录路径' } },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'runCommand',
      description: `在终端执行命令，短命令会阻塞直至结束。。。
      重要：命令会在当前目录中执行，尽量不要使用 cd 命令切换目录
      常规： install/build/test等同步执行，stdout和stderr汇总返回 \n 
      `,
      parameters: {
        type: 'object',
        properties: { commandLine: { type: 'string', description: '终端执行的命令（如：npm install）' } },
        required: ['commandLine']
      }
    }
  }
]


const toolHandleByName = {
  readFile: new ReadText(),
  writeFile: new WriteText(),
  editFile: new EditFile(),
  listDir: new ListDir(),
  createDirectory: new CreateDirectory(),
  runCommand: new RunCommand()
}

export {
  toolHandleByName,
  MODEL_TOOL_DEFINATIONS
}
