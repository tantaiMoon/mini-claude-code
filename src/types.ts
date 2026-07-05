import type { ChildProcess } from 'node:child_process'
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam
} from 'openai/resources/chat/completions'

export type JsonObject = Record<string, unknown>

export interface ToolRunner<TArgs extends JsonObject = JsonObject> {
  run(args: TArgs): Promise<string | null | undefined> | string | null | undefined
}

export type ToolRunnerMap = Record<string, ToolRunner>
export type ModelToolDefinition = ChatCompletionTool
export type AgentMessage = ChatCompletionMessageParam
export type ToolResponseMessage = ChatCompletionToolMessageParam & { name: string }

export interface PathToolArgs extends JsonObject {
  path: string
}

export interface WriteFileArgs extends PathToolArgs {
  content: string
}

export interface EditFileArgs extends WriteFileArgs {
  oldText: string
}

export interface RunCommandArgs extends JsonObject {
  commandLine: string
}

export interface ReadSkillArgs extends JsonObject {
  skill: string
}

export interface BackgroundProcessMeta {
  commandLine: string
  child: ChildProcess
  buffers: Buffer[]
}

export interface SkillDefinition {
  name: string
  description: string
  body: string
}

export interface SlashCommand {
  skill: SkillDefinition
  args: string
}
