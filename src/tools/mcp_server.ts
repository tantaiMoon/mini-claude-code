// 示例 MCP 服务端：通过 stdio 暴露一个 greet 工具给本项目的 MCP 客户端。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

// 服务名称和版本会在 MCP 握手阶段提供给客户端。
const server = new McpServer({ name: 'greeting-server', version: '1.0.0' })

// 注册一个最小工具，用于验证 MCP 工具发现、参数校验和调用链路。
server.registerTool('greet', {
  description: '通过工具打招呼',
  inputSchema: {
    name: z.string().describe('打招呼对象的名称')
  }
}, async ({ name }) => ({
  content: [{ type: 'text', text: `你好呀！ ${ name }` }]
}))

async function main(): Promise<void> {
  // 服务端使用 stdio 传输，适合被父进程以子进程方式拉起。
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// MCP 服务进程异常时写入 stderr，父进程可通过 transport.stderr 读取。
main().catch(e => {
  console.error(e)
})
