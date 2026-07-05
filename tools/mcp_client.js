import path from 'path'
import { fileURLToPath } from "node:url"
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

const SERVER_SCRIPT = fileURLToPath(new URL('./mcp_server.js', import.meta.url))

// MCP 客户端连接是进程级单例，避免重复启动服务端子进程。
let client = null

// 缓存转换后的 OpenAI 工具定义，供模型请求时直接使用。
let openAIToolDefinitions = []

// 记录当前 MCP 服务器暴露的工具名，用于区分本地工具和 MCP 工具。
const toolNames = new Set()

// 将 MCP tool schema 转换成 OpenAI function calling 能识别的工具定义。
function mcpToolToOpenAI(tool){
  // MCP 工具可能没有输入 schema，OpenAI 侧至少需要一个 object 参数定义。
  const schema = tool.inputSchema || {type: 'object', properties: {}}
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
  // 返回最近一次连接 MCP 服务器后缓存的工具定义。
  return openAIToolDefinitions
}

async function connectMcpServer(){
  // 已连接时直接复用，调用方可重复执行初始化逻辑。
  if (client) return {
    client, toolNames,openAIToolDefinitions
  }

  // 使用当前 Node 可执行文件启动本地 MCP 服务器脚本，并通过 stdio 通信。
  const transport = new StdioClientTransport({
    command: process.execPath, //制定 Nodejs 的可执行文件路径
    args: [SERVER_SCRIPT], // 指定MCP服务器脚本
    cwd: path.dirname(SERVER_SCRIPT), // 指定当前工作目录
    stderr: 'pipe' , // 标准输出错误使用管道
  })
  // 客户端元信息会在 MCP 握手时发送给服务端。
  client = new Client({
    name: 'mcp-client',
    version: '1.0.0',

  })
  // 建立连接时会拉起服务器子进程，父子进程通过 stdin/stdout 交换 MCP 消息。
  await client.connect(transport)

  // 拉取 MCP 服务器工具列表，并同步 OpenAI 工具定义缓存。
  const {tools} = await client.listTools()
  openAIToolDefinitions = tools.map(mcpToolToOpenAI)
  toolNames.clear()
  // 单独缓存工具名，便于 core.js 快速判断工具调用是否需要转发到 MCP。
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
  // 只有连接并刷新过工具列表的名称才会被认定为 MCP 工具。
  return toolNames.has(name)
}

// 转发一次 MCP 工具调用，并把结构化结果压平成文本交给模型。
async function callMcpTool(name, args){
  if (!client) throw new Error('MCP 未连接服务器')
  const result = await client.callTool({
    name,
    arguments: args
  })

  return mcpResultToText(result)
}

// 只保留 text 类型内容块，避免把模型暂不能直接消费的结构返回给对话。
function mcpResultToText(result) {
  if (!result?.content?.length) return 'mcp无返回内容'
  return result?.content?.filter(block => block.type === 'text').map(block => block.text).join('\n')
}

// 关闭 MCP 客户端连接，并清空由连接派生的工具缓存。
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
