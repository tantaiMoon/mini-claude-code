#!/usr/bin/env node
import fsp from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { WORK_DIR, getErrorMessage } from './utils'
import { runAgentUtilReplyMaxSteps } from './core.js'
import { closeMcpConnection, connectMcpServer } from './tools/mcp_client'
import { refreshModelToolDefinitions } from './tools/tools-define'
import { enrichSystem, loadSkills, parseSlash } from './tools/skills'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

dotenv.config({ override: true })

// 基础系统提示词会在启动后追加已发现的 Skill 摘要。
const AGENT_SYSTEM_INSTRUCTION_BASE = `你是 Claude Code，在受控的工作空间内（当前目录或用户指定）内协助用于读改代码，跑命令的智能助手工具;当用户执行某些操作是，你可以调用 MCP 工具`

function createAskLine(rl: readline.Interface): () => Promise<string> {
  // 将 readline 的回调式提问封装成 Promise，便于在主循环中 await。
  return () => new Promise(resolve => {
    rl.question('> ', resolve)
  })
}

export async function main(): Promise<void> {
  // 命令行交互入口：持续读取用户输入，并把每次输入交给 Agent 循环处理。
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  })
  const askLine = createAskLine(rl)

  rl.once('SIGINT', () => {
    // Ctrl+C 时主动关闭 readline，避免终端停留在半输入状态。
    console.log('\n已中断，下次再见')
    rl.close()
    process.exit(0)
  })

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

  // 先加载技能，再把技能摘要拼进系统提示词，供模型决定是否调用 readSkill。
  await loadSkills()
  const agentSystemInstruction = enrichSystem(AGENT_SYSTEM_INSTRUCTION_BASE)
  try {
    // MCP 连接成功后刷新模型可见的工具定义，让远端工具也能被调用。
    await connectMcpServer()
    refreshModelToolDefinitions()
  } catch (e) {
    // MCP 是增强能力，连接失败时保留本地工具继续启动交互。
    console.warn(`没有成功连接 MCP 服务：${ getErrorMessage(e) }`)
  }
  // 每次用户输入都创建一段新的消息历史，当前实现不跨轮保留上下文。
  for (; ;) {
    const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: agentSystemInstruction }]
    const line = await askLine()
    if (!line.trim()) continue
    if (line.trim() === 'q') break
    // /skill 形式的输入会展开成“按该 Skill 执行”的用户消息。
    const slash = parseSlash(line)
    const userContent = slash ? `请按Skill/${ slash.skill.name }执行：\n\n ${ slash.skill.body }${ slash.args ? `\n\n用户补充：${ slash.args }` : '' }` : line
    messages.push({ role: 'user', content: userContent })
    const reply = await runAgentUtilReplyMaxSteps(messages)
    if (reply) {
      console.log(`\nAssistant:\n ${ reply.content ?? '' }`)
    }
    // console.log('○ ',line)
    // console.log('\n')
  }
  rl.close()
  await closeMcpConnection().catch(() => {})
}

function isDirectRun(): boolean {
  const entry = process.argv[1]
  return Boolean(entry && path.resolve(entry) === fileURLToPath(import.meta.url))
}

if (isDirectRun()) {
  // 兜底捕获启动或主循环异常，退出前尽量释放 MCP 连接。
  main().catch(async e => {
    console.error(e)
    await closeMcpConnection().catch(() => {})
    process.exit(1)
  })
}
