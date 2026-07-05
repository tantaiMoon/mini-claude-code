// 简单的本地 HTTP 服务示例，可用于验证 runCommand 的长驻进程识别。
import http from "http"

// 服务监听端口。
const PORT = 1000

// 任意请求都返回纯文本 1000，便于用浏览器或 curl 快速确认服务可用。
const server = http.createServer((req, res) => {
  res.statusCode = 200
  // 明确返回纯文本，避免客户端按 HTML 解析。
  res.setHeader('Content-Type'
    , 'text/plain'
  )
  res.end('1000')
})

// 启动后打印访问地址，便于从终端日志中确认监听成功。
server.listen(PORT, () => {
  console.log(`Server running at http://localhost：${ PORT }/`)
})
