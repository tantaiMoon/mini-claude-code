import { OpenAI } from 'openai'
import {
  getActiveModelDefinitions,
  toolHandleByName
} from './tools/tools-define.js'
// 加载 env 配置文件，并允许覆盖已存在的环境变量
import dotenv from 'dotenv'
import { CONFIG } from './utils/index.js'
import { callMcpTool, isMcpTool } from './tools/mcp_client.js'

dotenv.config({ override: true })

const openaiClient = new OpenAI({
  baseURL: process.env.BASE_URL,
  apiKey: process.env.API_KEY
})

// 定义异步函数，用于执行一次工具调用
/*
 * @param toolCallPayload {index: number, id: string, type: 'function', function :{name: string, arguments: '{...}'}
 * */
export async function executeSingleToolCall(toolCallPayload) {
  const name = toolCallPayload.function.name
  let parsedArgs = {}
  try {
    parsedArgs = JSON.parse(toolCallPayload.function.arguments)
  } catch (e) {
    parsedArgs = {}
  }
  console.log(`工具${ name }被调用`)
  console.log(`参数：${ JSON.stringify(parsedArgs) }`)

  // 根据工具名称获取对应的处理器
  const handler = toolHandleByName[name]
  let textResult
  if (isMcpTool(name)) {
  //   是不是 MCP 服务器工具,如果是则尝试调用MCP服务器工具
    textResult = await callMcpTool(name, parsedArgs)
  } else {
    try {
      textResult = handler ? await handler.run(parsedArgs) : `没有找到工具： ${ name }`
    } catch (e) {
      textResult = '工具执行异常：' + e.message
    }
  }


  // 构建并返回本次工具调用的完整回复消息对象
  return {
    role: 'tool',
    tool_call_id: toolCallPayload.id,
    name,
    content: textResult == null ? '工具未返回内容' : String(textResult)
  }
}


// 定义异步函数，驱动智能体连续推理直到获得文字回复或超过最大步数
export async function runAgentUtilReplyMaxSteps(messages) {
  let step = 0 // 初始化步数器
  // 循环直到步数超过最大步长限制
  while (step < CONFIG.agentMaxSteps) {
    step++
    console.log(`\n请求模型中......`)
    // 调用 openai 客户端向大模型发送所有消息，生成聊天内容
    const completion = await openaiClient.chat.completions.create({
      model: 'deepseek-v4-pro',
      messages: messages,
      tools: getActiveModelDefinitions(), // 给大模型的工具函数定义
      tool_choice: 'auto' // 工具的选择方式为自动
    })
    // 获取助手回复的消息
    const assistantMessage = completion.choices[0].message
    // console.log('assistant: ', JSON.stringify(assistantMessage,null,2))
    messages.push(assistantMessage)

    const calls = assistantMessage.tool_calls // 获取本轮消息产生的工具调用
    // 没有调用工具的情况下
    if (!calls || calls.length === 0) {
      return assistantMessage
    }
    // 判断是否存在命令执行，决定是串行调用还是并行调用
    const sequentail = calls.some(call => call.function.name === 'runCommand')
    let toolResponses = []
    if (sequentail) {
      //   串行依次执行
      for (const tool of calls) {
        const res = await executeSingleToolCall(tool)
        toolResponses.push(res)
      }
    } else {
      // 并发执行每个工具调用，等待所有的工具调用结果返回
      //并发执行
      toolResponses = await Promise.all(calls.map(executeSingleToolCall))
    }
    // 将所有的消息提示添加到消息列表中
    for (const res of toolResponses) {
      messages.push(res)
    }
  }

  return {
    role: 'assistant',
    content: '对话的步数已达上限'
  }
}
