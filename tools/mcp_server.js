// 导入McpServer类
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// 导入StdioServerTransport类
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// 导入zod库用于数据验证
import { z } from 'zod';
// 创建一个名为"greeting-server"，版本为"1.0.0"的McpServer实例
const server = new McpServer({ name: "greeting-server", version: "1.0.0" });
server.registerTool('greet', {
  description: '通过工具打招呼',
  inputSchema: {
    name: z.string().describe('打招呼对象的名称')
  }},
  async ({ name }) => ({
content: [{type: 'text', text: `你好呀！ ${name}`}]
  })
)

async function main(){
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(e => {
  console.error(e)
})
