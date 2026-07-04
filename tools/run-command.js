import { spawnSync,spawn } from 'child_process';
import iconv from 'iconv-lite'
import { backgroundProcess, CONFIG, WORK_DIR } from '../utils/index.js'

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
  // 异步的方式运行命令 commandline ，
  async run({commandLine}){
    try {
      const input = commandLine
      if (typeof input !== 'string' || !input.trim()) {
        return '执行失败：commandLine 不能为空'
      }

      const backgroundTaskControlReply = this.handleBackgroundTaskControllerCommand(input)
      // 如果解析出是控制后台任务的命令，则不再向下执行
      if (backgroundTaskControlReply !== null) return backgroundTaskControlReply

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
    // 启动一个新的子进程
    const child = spawn(commandLine, {
      shell: true,
      cwd: WORK_DIR,
      stdio: ['ignore', 'pipe', 'pipe'], // 配置子进程的标准输入为忽略，标准输出和错误重定向到管道中


    })
    // 绑定子进程的标准输出到buffers 缓冲区
    bindStreamsBuffers(child.stdout, buffers)
    bindStreamsBuffers(child.stderr, buffers)

    const pid = child.pid
    // 启动后台任务子进程时，把当前的子进程信息存储到 backgroundProcess 映射中。
    // 记录内容： 启动的命令，子进程本身，子进程输出的缓冲区buffer
    backgroundProcess.set(pid, {
commandLine,child,buffers
    })
    child.once('exit', () => backgroundProcess.delete(pid))
    await delay(CONFIG.backgroundWarmupMs)
    return `子进程成功启动（PID：${pid}）\n命令：${commandLine}\n输出：${Buffer.concat(buffers).toString('utf-8')||''}`
  }

  // 检查并处理后台任务的指令
  handleBackgroundTaskControllerCommand(commandLine) {
    // p\判断是否为 task_list 指令，不区分大小写，可带空格和行尾
    if (/^task_list(\s|$)/i.test(commandLine)) {
      if (backgroundProcess.size === 0) return `当前没有登记的后台任务`
      return [
        '[后台任务概览]',
          ...[...backgroundProcess].map(([pid, meta]) => `- ${pid} ${meta.child.exitCode == null?'活动中':'已结束'} ${meta.commandLine}`)
      ].join('\n')
    }
    // 匹配日志
    const logsMatch = /^task_logs\s+(\d+)\s*$/i.exec(commandLine.trim())
    if (logsMatch) {
      // 匹配的结果中获取 pid
      const pid = Number.parseInt(logsMatch[1], 10)
      if (!backgroundProcess.has(pid)) return `没有找到PID： ${pid}`
      const { buffers } = backgroundProcess.get(pid)
      // 将缓冲区列表中的文件转为字符串并截取末尾的若干行
      const text = tailTextLine(buffersToText(buffers), CONFIG.backgroundLogPreviewLines)
      return [
        `[PID：${pid}]`,
          text
      ].join('\n')
    }
    const stopMatch = /^task_stop\s+(\d+)\s*$/i.exec(commandLine.trim())
    if (stopMatch) {
      // 匹配的结果中获取 pid
      const pid = Number.parseInt(stopMatch[1], 10)
      if (!backgroundProcess.has(pid)) return `没有找到PID： ${pid}`
      // 获取 pid 对应的子进程
      const { buffers, child } = backgroundProcess.get(pid)
      try {
        // windows 平台杀掉进程
        if (process.platform === 'win32') {
          spawnSync(`taskkill /PID ${pid} \T \F`, {shell: true, stdio: 'ignore'})
        } else {
          // 非 Windows 通过向进程组发送 SIGTERM 信号终止进程
          process.kill(-pid,'SIGTERM')
        }
      } catch(e) {
        // 如果失败了则直接让子进程调用 kill 杀掉进程
        child.kill('SIGTERM')
      }
      // 后台进程注册表中删除 该 pid
      backgroundProcess.delete(pid)
      // 将缓冲区列表中的文件转为字符串并截取末尾的若干行
      return [
        `[后台进程已结束，PID：${pid}]`,
      ].join('\n')
    }
    return null
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


function lookLikeLongRunningCommandLine(commandLine){
  const normalizedCommandLine = commandLine.trim().toLowerCase() // 去除收尾空格并转为小写
  return LONG_RUNNING_HINTS.some(hit => normalizedCommandLine.includes(hit))
}

// 将子进程的 buffer 解码为可读的字符
function decodeResultBuffer(buffer) {
  if (!buffer || buffer.length === 0) return ''
  if (process.platform === 'win32') return iconv.decode(buffer, 'cp936') // Windows中文环境一般为 cp936
  return buffer.toString('utf8')
}

function bindStreamsBuffers(readableStream, buffers) {
  readableStream.on('data', (chunk) => {
    buffers.push(chunk)
  })
}

// 取文本末尾的 lines 行
function tailTextLine(text, lines){
  if(!text) return ''
  return text.split(/\r?\n/).slice(-lines).join('\n')
}
// 将收集到的 buffers 转化为文本字符串
function buffersToText(buffers){
  const chunks = buffers.filter(chunk => chunk !== null)
  if (chunks.length === 0) return ''
  return decodeResultBuffer(Buffer.concat(chunks))
}
