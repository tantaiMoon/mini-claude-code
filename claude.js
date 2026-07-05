import readline from 'readline'
import fsp from 'fs/promises'
import { WORK_DIR } from './utils/index.js'
import { runAgentUtilReplyMaxSteps } from './core.js'
// 加载 env 配置文件，并允许覆盖已存在的环境变量
import dotenv from 'dotenv'
import { closeMcpConnection, connectMcpServer } from './tools/mcp_client.js'
import { refreshModelToolDefinitions } from './tools/tools-define.js'
import { loadSkills, getSkill, enrichSystem, parseSlash } from './tools/skills.js'

dotenv.config({ override: true })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
})

rl.once('SIGINT', () => {
  console.log('\n已中断，下次再见')
  rl.close()
  process.exit(0)
})

const askLine = () => new Promise((resolve, reject) => {
  rl.question('> ', resolve)
})

// 系统提示词
const AIGENT_SYSTEM_INSTRUCTION_BASE = `你是 Claude Code，在受控的工作空间内（当前目录或用户指定）内协助用于读改代码，跑命令的智能助手工具;当用户执行某些操作是，你可以调用 MCP 工具`
let agentSystemInstruction = AIGENT_SYSTEM_INSTRUCTION_BASE

async function main() {

  console.log(`
  ------------- Mini Claude Code ---------------
  |                                            |
  |               Welcome Back!                |
  |                                            |
  |         model: deepseek-v4-pro             |
  |                                            |
  ----------------------------------------------`)

  // 创建工作区目录
  await fsp.mkdir(WORK_DIR, { recursive: true })

  // 异步加载所有的技能
  const skills = await loadSkills()
  // 根据基础系统提示词增强系统级别的说明
  agentSystemInstruction = enrichSystem(AIGENT_SYSTEM_INSTRUCTION_BASE)
  try {
    await connectMcpServer()
    refreshModelToolDefinitions()
  } catch (e) {
    console.warn(`没有成功连接 MCP 服务：${ e.message }`)
  }
  // AgentLoop
  for (; ;) {
    // role ： 用户 user， ai assistant ， 工具 tool
    // 1、系统提示词；2、用户输入；3、大模型调用工具；4、调用的结果（往复3、4）；大模型返回的结果
    const messages = [{ role: 'system', content: agentSystemInstruction }]
    const line = await askLine()
    if (!line.trim()) continue
    if (line.trim() === 'q') break
    const slash = parseSlash(line) // 尝试解析用户输入的 / 命令
    const userContent = slash ? `请按Skill/${ slash.skill.name }执行：\n\n ${ slash.skill.body }` + (slash.args ? `\n\n用户补充：${ slash.args }` : '') : line
    // / 将用户输入的内容加入到消息列表
    messages.push({ role: 'user', content: userContent })
    const reply = await runAgentUtilReplyMaxSteps(messages)
    if (reply) {
      console.log(`\nAssistant:\n ${ reply.content }`)
    }
    // console.log('○ ',line)
    // console.log('\n')
  }
  rl.close()
  await closeMcpConnection().catch(() => {})
}

main().catch(async e => {
  console.error(e)
  await closeMcpConnection().catch(() => {})
  process.exit(1)
})
