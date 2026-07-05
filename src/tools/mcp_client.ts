import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { CallToolResult, Tool as McpTool } from '@modelcontextprotocol/sdk/types.js'
import type { ChatCompletionTool } from 'openai/resources/chat/completions'

const SERVER_SCRIPT = fileURLToPath(new URL('./mcp_server.js', import.meta.url))

interface McpConnection {
  client: Client
  toolNames: Set<string>
  openAIToolDefinitions: ChatCompletionTool[]
}

// MCP 客户端连接是进程级单例，避免重复启动服务端子进程。
let client: Client | null = null

// 缓存转换后的 OpenAI 工具定义，供模型请求时直接使用。
let openAIToolDefinitions: ChatCompletionTool[] = []

// 记录当前 MCP 服务器暴露的工具名，用于区分本地工具和 MCP 工具。
const toolNames = new Set<string>()

// 将 MCP tool schema 转换成 OpenAI function calling 能识别的工具定义。
function mcpToolToOpenAI(tool: McpTool): ChatCompletionTool {
  // MCP 工具可能没有输入 schema，OpenAI 侧至少需要一个 object 参数定义。
  const schema = tool.inputSchema || { type: 'object', properties: {} }
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || `MCP Tool: ${ tool.name }`,
      parameters: schema as Record<string, unknown>
    }
  }
}

function getMcpOpenAiTools(): ChatCompletionTool[] {
  // 返回最近一次连接 MCP 服务器后缓存的工具定义。
  return openAIToolDefinitions
}

async function connectMcpServer(): Promise<McpConnection> {
  // 已连接时直接复用，调用方可重复执行初始化逻辑。
  if (client) return {
    client,
    toolNames,
    openAIToolDefinitions
  }

  // 使用当前 Node 可执行文件启动本地 MCP 服务器脚本，并通过 stdio 通信。
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_SCRIPT],
    cwd: path.dirname(SERVER_SCRIPT),
    stderr: 'pipe'
  })
  // 客户端元信息会在 MCP 握手时发送给服务端。
  client = new Client({
    name: 'mcp-client',
    version: '1.0.0'
  })
  // 建立连接时会拉起服务器子进程，父子进程通过 stdin/stdout 交换 MCP 消息。
  await client.connect(transport)

  // 拉取 MCP 服务器工具列表，并同步 OpenAI 工具定义缓存。
  const { tools } = await client.listTools()
  openAIToolDefinitions = tools.map(mcpToolToOpenAI)
  toolNames.clear()
  // 单独缓存工具名，便于 core.ts 快速判断工具调用是否需要转发到 MCP。
  for (const tool of tools) {
    toolNames.add(tool.name)
  }

  return {
    client,
    toolNames,
    openAIToolDefinitions
  }
}

function isMcpTool(name: string): boolean {
  // 只有连接并刷新过工具列表的名称才会被认定为 MCP 工具。
  return toolNames.has(name)
}

// 转发一次 MCP 工具调用，并把结构化结果压平成文本交给模型。
async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  if (!client) throw new Error('MCP 未连接服务器')
  const result = await client.callTool({
    name,
    arguments: args
  }) as CallToolResult

  return mcpResultToText(result)
}

function isTextBlock(block: CallToolResult['content'][number]): block is Extract<CallToolResult['content'][number], { type: 'text' }> {
  return block.type === 'text'
}

// 只保留 text 类型内容块，避免把模型暂不能直接消费的结构返回给对话。
function mcpResultToText(result: CallToolResult): string {
  if (!result?.content?.length) return 'mcp无返回内容'
  return result.content.filter(isTextBlock).map(block => block.text).join('\n')
}

// 关闭 MCP 客户端连接，并清空由连接派生的工具缓存。
async function closeMcpConnection(): Promise<void> {
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
