import { spawnSync,spawn } from 'child_process';
import iconv from 'iconv-lite'
import { CONFIG, WORK_DIR } from '../utils/index.js'

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

    if (lookLikeLongRunningCommandLine(commandLine)){
      return this.runBackgroundCommandLine(input);
    }else {
      return this.runBlockingCommandLine(input);
    }
    } catch(e) {
      return '执行异常：'+e.message;
    }
  }

  runBlockingCommandLine(commandline) {
    const result = spawn(commandline, {
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

    const pid = child.pid
    await delay(CONFIG.backgroundWarmupMs)
    return `子进程成功启动（PID：${pid}）\n命令：${commandLine}\n输出：${Buffer.concat(buffers).toString('utf-8')||''}`
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
