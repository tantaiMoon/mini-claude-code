import { ReadText } from './read-file.js'
import { WriteText } from './write-file.js'
import { EditFile } from './edit-file.js'
import { ListDir } from './list-dir.js'
import { CreateDirectory } from './create-dir.js'
import { RunCommand } from './run-command.js'
import { getMcpOpenAiTools } from './mcp_client.js'
import { ReadSkill } from './read-skill.js'
import type { ModelToolDefinition, ToolRunnerMap } from '../types.js'

// 内置工具的 OpenAI function schema，决定模型能看到的工具名称、用途和参数结构。
const LOCAL_MODEL_TOOL_DEFINATIONS = [
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
      description: `在终端执行命令，短命令会阻塞直至结束，疑似开发服务器等长时运行命令会在后台拉起\n
      重要：命令会在当前目录中执行，尽量不要使用 cd 命令切换目录\n
      常规： install/build/test等同步执行，stdout和stderr汇总返回 \n 
      常驻命令： pnpm dev/ npm start / flask run / uvicorn 等后台运行任务，约 8 秒后回传PID与启动阶段日志 \n 
      后台子命令：\n
          task_list       列出已登记的后台任务\n
          task_logs <pid> 拉取该pid最近若干行日志\n
          task_stop <pid> 结束该后台任务\n
      `,
      parameters: {
        type: 'object',
        properties: { commandLine: { type: 'string', description: '终端执行的命令（如：npm install）' } },
        required: ['commandLine']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'readSkill',
      description: `加载Skill完整的正文：任务与系统提示词中的Skill匹配使用
      `,
      parameters: {
        type: 'object',
        properties: { skill: { type: 'string', description: 'skill名称，目录名或者SKILL.md 的 frontmatter 中的 name' } },
        required: ['skill']
      }
    }
  }
] satisfies ModelToolDefinition[]

// 当前暴露给模型的工具定义；启动时只有本地工具，MCP 连接后会追加远端工具。
let activeModelDefinitions: ModelToolDefinition[] = [...LOCAL_MODEL_TOOL_DEFINATIONS]

function refreshModelToolDefinitions(): void {
  // MCP 工具定义来自服务器 listTools 结果，需要在连接后刷新。
  activeModelDefinitions = [...LOCAL_MODEL_TOOL_DEFINATIONS, ...getMcpOpenAiTools()]
}

function getActiveModelDefinitions(): ModelToolDefinition[] {
  return activeModelDefinitions
}

// 工具名到本地执行器实例的映射，core.ts 会根据模型返回的 name 查找执行器。
const toolHandleByName: ToolRunnerMap = {
  readFile: new ReadText(),
  writeFile: new WriteText(),
  editFile: new EditFile(),
  listDir: new ListDir(),
  createDirectory: new CreateDirectory(),
  readSkill: new ReadSkill(),
  runCommand: new RunCommand()
}

export {
  toolHandleByName,
  refreshModelToolDefinitions,
  getActiveModelDefinitions,
  LOCAL_MODEL_TOOL_DEFINATIONS
}
