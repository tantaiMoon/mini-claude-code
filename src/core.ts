import OpenAI from 'openai'
import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessage,
  ChatCompletionMessageFunctionToolCall,
  ChatCompletionMessageParam
} from 'openai/resources/chat/completions'
import {
  getActiveModelDefinitions,
  toolHandleByName
} from './tools/tools-define'
// 加载 env 配置文件，并允许覆盖已存在的环境变量
import dotenv from 'dotenv'
import { CONFIG, getErrorMessage } from './utils'
import { callMcpTool, isMcpTool } from './tools/mcp_client'
import type { ToolResponseMessage } from './types'

dotenv.config({ override: true })

// OpenAI 兼容客户端统一从环境变量读取网关地址和密钥。
const openaiClient = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY
})

// 执行模型返回的一次工具调用，并把执行结果转换为 OpenAI tool 消息。
// toolCallPayload 形如 { id, type: 'function', function: { name, arguments } }。
export async function executeSingleToolCall(toolCallPayload: ChatCompletionMessageFunctionToolCall): Promise<ToolResponseMessage> {
  const name = toolCallPayload.function.name
  let parsedArgs: Record<string, unknown> = {}
  try {
    // 模型返回的 arguments 是 JSON 字符串，解析失败时降级为空参数，避免中断整轮对话。
    parsedArgs = JSON.parse(toolCallPayload.function.arguments) as Record<string, unknown>
  } catch (e) {
    parsedArgs = {}
  }
  console.log(`工具${ name }被调用`)
  console.log(`参数：${ JSON.stringify(parsedArgs) }`)

  // 本地工具从注册表查找，MCP 工具交给 MCP 客户端转发。
  const handler = toolHandleByName[name]
  let textResult: string | null | undefined
  if (isMcpTool(name)) {
    // MCP 工具名称来自已连接服务器的工具列表。
    textResult = await callMcpTool(name, parsedArgs)
  } else {
    try {
      textResult = handler ? await handler.run(parsedArgs) : `没有找到工具： ${ name }`
    } catch (e) {
      textResult = `工具执行异常：${ getErrorMessage(e) }`
    }
  }

  // 返回格式必须带上 tool_call_id，模型下一轮才能关联到对应的工具调用。
  return {
    role: 'tool',
    tool_call_id: toolCallPayload.id,
    name,
    content: textResult == null ? '工具未返回内容' : String(textResult)
  }
}

// 驱动 Agent 循环：模型可连续请求工具，直到生成最终文本回复或超过最大步数。
export async function runAgentUtilReplyMaxSteps(
  messages: ChatCompletionMessageParam[]
): Promise<ChatCompletionMessage | ChatCompletionAssistantMessageParam> {
  let step = 0
  while (step < CONFIG.agentMaxSteps) {
    step++
    console.log('\n请求模型中......')
    // 每一轮都带上完整消息历史和当前可用工具定义。
    const completion = await openaiClient.chat.completions.create({
      model: 'deepseek-v4-pro',
      messages,
      tools: getActiveModelDefinitions(),
      tool_choice: 'auto'
    })
    const assistantMessage = completion.choices[0].message
    // console.log('assistant: ', JSON.stringify(assistantMessage,null,2))
    messages.push(assistantMessage as ChatCompletionMessageParam)

    // 没有工具调用说明模型已经给出最终回复。
    const calls = assistantMessage.tool_calls as ChatCompletionMessageFunctionToolCall[] | undefined
    if (!calls || calls.length === 0) {
      return assistantMessage
    }
    // runCommand 可能影响全局工作区或后台任务状态，因此包含它时按顺序执行。
    const sequentail = calls.some(call => call.function.name === 'runCommand')
    let toolResponses: ToolResponseMessage[] = []
    if (sequentail) {
      for (const tool of calls) {
        const res = await executeSingleToolCall(tool)
        toolResponses.push(res)
      }
    } else {
      // 只读或互不依赖的工具调用并发执行，缩短单轮等待时间。
      toolResponses = await Promise.all(calls.map(executeSingleToolCall))
    }
    // 工具结果追加回消息列表，供模型下一轮继续推理。
    for (const res of toolResponses) {
      messages.push(res)
    }
  }

  return {
    role: 'assistant',
    content: '对话的步数已达上限'
  }
}
