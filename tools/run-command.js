import { spawnSync,spawn } from 'child_process';
import iconv from 'iconv-lite'
import { backgroundProcess, CONFIG, WORK_DIR } from '../utils/index.js'

// 命令中包含这些关键词时，倾向认为它会长期运行并放入后台。
const LONG_RUNNING_HINTS = [
  'dev',
  'start',
  'server'
  ,'service'
  ,'serve'
  ,'watch'
  ,'run server'
  ,'runserver'
  ,'preview'
  ,'nodemon'
  ,'uvicorn'
  ,'gunicorn'
  ,'flask run'
  ,'vite'
  ,'webpack'
  ,'--watch'
  ,'--hot'
]

export class RunCommand {
  // 统一入口：校验命令、处理后台任务控制命令，再决定同步或后台执行。
  async run({commandLine}){
    try {
      const input = commandLine
      if (typeof input !== 'string' || !input.trim()) {
        return '执行失败：commandLine 不能为空'
      }

      const backgroundTaskControlReply = this.handleBackgroundTaskControllerCommand(input)
      // task_list/task_logs/task_stop 是内置控制命令，不会传给 shell。
      if (backgroundTaskControlReply !== null) return backgroundTaskControlReply

      // 疑似长驻命令放入后台，普通命令阻塞等待执行完成。
      if (lookLikeLongRunningCommandLine(input)){
        return this.runBackgroundCommandLine(input);
      }else {
        return this.runBlockingCommandLine(input);
      }
    } catch(e) {
      return '执行异常：'+e.message;
    }
  }

  runBlockingCommandLine(commandline) {
    // 同步命令直接在工作区执行，并把 stdout/stderr 合并成文本返回。
    const result = spawnSync(commandline, {
      shell: true,
      cwd: WORK_DIR,
      encoding: 'buffer', // 输出二进制格式
      maxBuffer: 10 * 1024 * 1024, // 最大缓冲区 10M
    });
    if(result.error?.code === 'ETIMEDOUT'){
      return `同步命令超时：${commandline}` // 命令执行超时
    }
    if (result.error) {
      return '执行异常：'+result.error.message;
    }
    let merged = result.stdout?.length ? decodeResultBuffer(result.stdout):'stdout为空'
    if(result.stderr?.length) {
      merged += `\n[stderr]\n${decodeResultBuffer(result.stderr)}` // 有错输出则合并
    }

    return result.status != 0 ? `退出码：${result.status}\n${merged}`: `执行完成：\n${merged}`
  }

  async runBackgroundCommandLine(commandLine) {
    const buffers = []
    // 长驻命令启动为后台子进程，输出先缓存在内存中供 task_logs 查询。
    const child = spawn(commandLine, {
      shell: true,
      cwd: WORK_DIR,
      stdio: ['ignore', 'pipe', 'pipe'], // 配置子进程的标准输入为忽略，标准输出和错误重定向到管道中


    })
    // stdout 和 stderr 共用一个缓冲列表，保持日志查看逻辑简单。
    bindStreamsBuffers(child.stdout, buffers)
    bindStreamsBuffers(child.stderr, buffers)

    const pid = child.pid
    // 后台任务注册表保存命令、子进程对象和日志缓冲区。
    backgroundProcess.set(pid, {
commandLine,child,buffers
    })
    // 子进程自行退出时，从注册表移除，避免 task_list 显示过期任务。
    child.once('exit', () => backgroundProcess.delete(pid))
    await delay(CONFIG.backgroundWarmupMs)
    return `子进程成功启动（PID：${pid}）\n命令：${commandLine}\n输出：${Buffer.concat(buffers).toString('utf-8')||''}`
  }

  // 检查并处理后台任务控制指令；未命中时返回 null。
  handleBackgroundTaskControllerCommand(commandLine) {
    // task_list 列出当前注册表中的后台任务。
    if (/^task_list(\s|$)/i.test(commandLine)) {
      if (backgroundProcess.size === 0) return `当前没有登记的后台任务`
      return [
        '[后台任务概览]',
          ...[...backgroundProcess].map(([pid, meta]) => `- ${pid} ${meta.child.exitCode == null?'活动中':'已结束'} ${meta.commandLine}`)
      ].join('\n')
    }
    // task_logs <pid> 返回指定后台任务的尾部日志。
    const logsMatch = /^task_logs\s+(\d+)\s*$/i.exec(commandLine.trim())
    if (logsMatch) {
      const pid = Number.parseInt(logsMatch[1], 10)
      if (!backgroundProcess.has(pid)) return `没有找到PID： ${pid}`
      const { buffers } = backgroundProcess.get(pid)
      // 缓冲区先按平台编码转文本，再截取末尾若干行。
      const text = tailTextLine(buffersToText(buffers), CONFIG.backgroundLogPreviewLines)
      return [
        `[PID：${pid}]`,
          text
      ].join('\n')
    }
    // task_stop <pid> 停止指定后台任务并从注册表移除。
    const stopMatch = /^task_stop\s+(\d+)\s*$/i.exec(commandLine.trim())
    if (stopMatch) {
      const pid = Number.parseInt(stopMatch[1], 10)
      if (!backgroundProcess.has(pid)) return `没有找到PID： ${pid}`
      const { buffers, child } = backgroundProcess.get(pid)
      try {
        // Windows 使用 taskkill 结束进程树，类 Unix 平台向进程组发送 SIGTERM。
        if (process.platform === 'win32') {
          spawnSync(`taskkill /PID ${pid} \T \F`, {shell: true, stdio: 'ignore'})
        } else {
          process.kill(-pid,'SIGTERM')
        }
      } catch(e) {
        // 进程组终止失败时，回退到直接终止子进程。
        child.kill('SIGTERM')
      }
      // 主动停止后立即删除注册记录，后续 task_list 不再展示。
      backgroundProcess.delete(pid)
      return [
        `[后台进程已结束，PID：${pid}]`,
      ].join('\n')
    }
    return null
  }
}

function delay(ms) {
  // 用于后台命令启动后的短暂预热，收集首批启动日志。
  return new Promise(resolve => setTimeout(resolve, ms));
}


function lookLikeLongRunningCommandLine(commandLine){
  // 关键词判断是启发式规则，命中后会使用后台执行路径。
  const normalizedCommandLine = commandLine.trim().toLowerCase()
  return LONG_RUNNING_HINTS.some(hit => normalizedCommandLine.includes(hit))
}

// 将子进程输出 buffer 解码为可读文本，兼容 Windows 中文控制台编码。
function decodeResultBuffer(buffer) {
  if (!buffer || buffer.length === 0) return ''
  if (process.platform === 'win32') return iconv.decode(buffer, 'cp936') // Windows中文环境一般为 cp936
  return buffer.toString('utf8')
}

function bindStreamsBuffers(readableStream, buffers) {
  // 数据到达时按 chunk 追加，避免阻塞后台进程输出。
  readableStream.on('data', (chunk) => {
    buffers.push(chunk)
  })
}

// 取文本末尾的 lines 行，用于限制 task_logs 返回体积。
function tailTextLine(text, lines){
  if(!text) return ''
  return text.split(/\r?\n/).slice(-lines).join('\n')
}
// 将收集到的 buffers 合并并按平台编码转成字符串。
function buffersToText(buffers){
  const chunks = buffers.filter(chunk => chunk !== null)
  if (chunks.length === 0) return ''
  return decodeResultBuffer(Buffer.concat(chunks))
}
