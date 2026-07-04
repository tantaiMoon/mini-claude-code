import path from 'path'
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_SCCRIPT = path.join(__dirname, 'mcp_server.js')

let client = null

let openAIToolDefinitions = []

const toolNames = new Set()

// mcp 服务转化为openAi工具定义
function mcpToolToOpenAI(tool){
  // 获取输入参数的 schema ，默认为空对象
  const schema = tool.inputSchema || {type: 'object', properties: {}}
  // openai格式定义工具
  return {
    type: 'function',
    function: {
      name: tool.name, // 工具名称
      description: tool.description || `MCP Tool: ${tool.name}`, // 工具描述
      parameters: schema// 工具参数
    }
  }
}

function getMcpOpenAiTools(){
  return openAIToolDefinitions
}

async function connectMcpServer(){
  if (client) return {
    client, toolNames,openAIToolDefinitions
  }

  // 创建 transport 用于连接MCP服务器
  const transport = new StdioClientTransport({
    command: process.execPath, //制定 Nodejs 的可执行文件路径
    args: [SERVER_SCCRIPT], // 指定MCP服务器脚本
    cwd: path.dirname(SERVER_SCCRIPT), // 指定当前工作目录
    stderr: 'pipe' , // 标准输出错误使用管道
  })
  // 创建一个 MCP 客户端
  client = new Client({
    name: 'mcp-client',
    version: '1.0.0',

  })
  // 父进程是 MCP 客户端进程，子进程就是 MCP 服务器进程
  // 建立与 服务器的链接，创建一个子进程然后再子进程中运行服务器脚本，然后通过子进程的 stdio 与父进程进行通信 stdout，stdin
  await client.connect(transport)

  // 获取MCP服务器的所有工具列表
  const {tools} = await client.listTools()
//   工具定义转换为 OpenAI格式
  openAIToolDefinitions = tools.map(mcpToolToOpenAI)
  toolNames.clear()
  // 最新的每个工具名称添加到工具集合中
  for (const tool of tools) {
    toolNames.add(tool.name)
  }

  return {
    client,
    toolNames,
    openAIToolDefinitions
  }
}

function isMcpTool(name){
  return toolNames.has(name)
}

// 调用MCP服务
async function callMcpTool(name, args){
  if (!client) throw new Error('MCP 未连接服务器')
  // 指定调用工具的名称和参数
  const result = await client.callTool({
    name,
    arguments: args
  })

  return mcpResultToText(result)
}

// 把 MCP 的执行结果转化为纯文本
function mcpResultToText(result) {
  if (!result?.content?.length) return 'mcp无返回内容'
  return result?.content?.filter(block => block.type === 'text').map(block => block.text).join('\n')
}

// 关闭与服务器的连接并释放清理资源
async function closeMcpConnection(){
  if (client) {
    await client.close()
    client = null
    toolNames.clear()
    openAIToolDefinitions = []
  }
}

export {
  connectMcpServer,
  getMcpOpenAiTools,
  isMcpTool,
  callMcpTool,
  closeMcpConnection
}