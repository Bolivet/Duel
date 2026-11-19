const http = require('http');
const { WebSocketServer } = require('ws');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('card-duel relay ok');
});

const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });
const rooms = new Map(); // 방 코드 -> 접속한 소켓들

wss.on('connection', (ws) => {
  ws.room = null;

  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch (e) { return; }

    // 처음 한 번: 방 입장
    if (m && m.type === 'join' && typeof m.room === 'string') {
      leave(ws);
      ws.room = m.room.toUpperCase().slice(0, 8);
      if (!rooms.has(ws.room)) rooms.set(ws.room, new Set());
      rooms.get(ws.room).add(ws);
      return;
    }

    // 그 외: 같은 방의 다른 기기에게 그대로 전달 (보낸 사람 제외)
    const peers = rooms.get(ws.room);
    if (!peers) return;
    const text = raw.toString();
    for (const p of peers) {
      if (p !== ws && p.readyState === 1) p.send(text);
    }
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

function leave(ws) {
  const peers = rooms.get(ws.room);
  if (!peers) return;
  peers.delete(ws);
  if (peers.size === 0) rooms.delete(ws.room);
}

server.listen(process.env.PORT || 3000);
