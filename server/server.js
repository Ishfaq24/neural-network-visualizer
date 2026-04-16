const express = require('express')
const cors = require('cors')
const { WebSocketServer } = require('ws')
const http = require('http')

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => res.json({ ok: true }))

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  console.log('ws connected')
  ws.on('message', (msg) => {
    // very small protocol: broadcast to all clients
    wss.clients.forEach(client => {
      if (client !== ws && client.readyState === client.OPEN) {
        client.send(msg)
      }
    })
  })
  ws.on('close', () => console.log('ws closed'))
})

const PORT = process.env.PORT || 4000
server.listen(PORT, () => console.log(`Server listening on ${PORT}`))