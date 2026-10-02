// Minimal stand-in for the Anthropic Messages API so AI Studio fulfilment can
// be tested without a real key or network. Started by playwright.config.ts.
import { createServer } from "node:http"

const server = createServer((req, res) => {
  if (req.method === "POST" && req.url?.startsWith("/v1/messages")) {
    let body = ""
    req.on("data", (c) => (body += c))
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}")
      res.writeHead(200, { "content-type": "application/json" })
      res.end(
        JSON.stringify({
          id: "msg_e2e",
          type: "message",
          role: "assistant",
          model: parsed.model ?? "mock",
          content: [{ type: "text", text: "E2E MOCK AI OUTPUT: your deliverable is ready." }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 10 },
        })
      )
    })
    return
  }
  res.writeHead(200).end("ok")
})
server.listen(4010, "127.0.0.1")
