# mini-claude-code

一个最小化的 Claude Code 风格智能体工具包。项目使用 TypeScript 编写，通过 OpenAI 兼容接口调用模型，并提供一组受工作区约束的工具，让模型可以读取文件、写入文件、编辑文件、列目录、创建目录和执行命令。

项目通过 Rollup 构建为 ESM npm 包，同时保留可执行 CLI。

## 功能概览

- 基于命令行交互：源码入口为 `src/mini-claude.ts`，构建后 CLI 文件为 `dist/cli.js`。
- 使用 OpenAI SDK 调用兼容 Chat Completions 的模型接口。
- 支持函数工具调用，工具定义位于 `src/tools/tools-define.ts`。
- 文件相关工具会通过 `src/utils/index.ts` 限制访问范围，避免越出当前工作目录。
- `runCommand` 支持短命令同步执行，也会将疑似常驻命令作为后台任务启动。
- `src/index.ts` 作为库入口导出核心 Agent 循环、工具类、MCP 连接和 Skill 能力。

## 环境要求

- Node.js 18 或更高版本
- pnpm

项目的 `package.json` 声明了 `packageManager` 为 `pnpm@10.30.2`。

## 安装依赖

```bash
pnpm install
```

## 环境变量

参考 `.env.example` 创建本地 `.env`：

```bash
API_KEY=
BASE_URL=https://api.deepseek.com
```

变量说明：

- `API_KEY`：模型服务 API Key。
- `BASE_URL`：OpenAI 兼容接口的 base URL。

不要提交真实 API Key 或其他敏感配置。

## 构建

```bash
pnpm build
```

构建产物输出到 `dist/`，包含 ESM JavaScript、类型声明和 sourcemap。`dist/` 是构建产物，不应提交到仓库。

## 类型检查

```bash
pnpm typecheck
```

## CLI 使用

```bash
pnpm build
node dist/cli.js
```

进入交互后输入需求即可。输入 `q` 退出，按 `Ctrl+C` 会中断程序。

作为 npm 包安装后，也可以通过 `mini-claude-code` 命令启动。

## 作为库使用

```ts
import {
  runAgentUtilReplyMaxSteps,
  connectMcpServer,
  refreshModelToolDefinitions
} from 'mini-claude-code'

await connectMcpServer()
refreshModelToolDefinitions()

const reply = await runAgentUtilReplyMaxSteps([
  { role: 'system', content: '你是一个代码助手' },
  { role: 'user', content: '列出当前目录' }
])

console.log(reply.content)
```

## 目录结构

```text
.
├── src/
│   ├── index.ts           # npm 库入口
│   ├── mini-claude.ts             # 命令行入口与交互循环
│   ├── core.ts            # 模型请求与工具调用调度
│   ├── tools/             # 工具定义、MCP 与 Skill 实现
│   └── utils/index.ts     # 工作目录、配置与路径安全校验
├── test/server.ts         # 本地长驻服务示例
├── rollup.config.mjs      # Rollup 构建配置
├── tsconfig.json          # TypeScript 类型检查配置
├── tsconfig.build.json    # TypeScript 构建配置
├── .env.example           # 环境变量示例
├── package.json
└── pnpm-lock.yaml
```

## 内置工具

| 工具名 | 作用 |
| --- | --- |
| `readFile` | 读取工作区内的 UTF-8 文本文件 |
| `writeFile` | 在工作区内新建或覆盖写入文件 |
| `editFile` | 对已有文件执行一次精确文本替换 |
| `listDir` | 列出目录条目 |
| `createDirectory` | 递归创建目录 |
| `runCommand` | 在当前工作目录执行终端命令 |

## 命令执行说明

`runCommand` 会在当前工作目录执行命令。普通短命令会同步执行并返回 stdout、stderr 和退出码。

如果命令看起来像开发服务或常驻进程，例如包含 `dev`、`start`、`serve`、`watch`、`vite`、`webpack` 等关键字，会被作为后台任务启动，并在预热后返回 PID 和启动阶段日志。

后台任务控制命令：

```text
task_list       列出已登记的后台任务
task_logs <pid> 查看指定后台任务最近日志
task_stop <pid> 结束指定后台任务
```

## 包入口

`package.json` 已声明：

- `main` / `module`：`./dist/index.js`
- `types`：`./dist/index.d.ts`
- `bin`：`mini-claude-code` -> `./dist/cli.js`
- `exports`：根入口、CLI 入口和 `tools/*` 子路径

## 当前限制

- 当前尚未配置测试运行器，`test` 脚本仍是占位命令。
- 模型名称在 `src/core.ts` 中固定为 `deepseek-v4-pro`。
- 工具的工作目录由启动进程时的 `process.cwd()` 决定。
- `runCommand` 对常驻命令的判断基于关键字启发式规则。
