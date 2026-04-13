import os from 'node:os';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import QRCode from 'qrcode';

interface ConnectInfoQuery {
  pair_id?: string;
}

interface QrQuery {
  value?: string;
}

function currentApiToken(): string {
  return process.env['EMA_API_TOKEN']?.trim() ?? '';
}

function authQueryParam(): string {
  const token = currentApiToken();
  if (!token) return '';
  return `api_token=${encodeURIComponent(token)}`;
}

function withQuery(url: string, keyValue: string): string {
  if (!keyValue) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${keyValue}`;
}

function collectLanIpv4(): string[] {
  const seen = new Set<string>();
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        seen.add(entry.address);
      }
    }
  }

  return [...seen];
}

function connectUrls(pairId: string): string[] {
  const query = authQueryParam();
  const suffix = `/phone/voice?pair=${encodeURIComponent(pairId)}`;
  const urls = collectLanIpv4().map((ip) => withQuery(`http://${ip}:4488${suffix}`, query));

  if (urls.length > 0) return urls;
  return [withQuery(`http://127.0.0.1:4488${suffix}`, query)];
}

function localBase(request: FastifyRequest): string {
  return `${request.protocol}://${request.headers.host ?? '127.0.0.1:4488'}`;
}

function renderPhonePage(): string {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Jarvis Phone Mic</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #061019;
        --panel: rgba(14, 24, 36, 0.88);
        --panel-border: rgba(140, 191, 220, 0.16);
        --text: #ecf7ff;
        --muted: rgba(220, 238, 248, 0.68);
        --accent: #41d7ff;
        --accent-strong: #8be9ff;
        --danger: #ff6b6b;
        --success: #5fd3a1;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top, rgba(65, 215, 255, 0.16), transparent 36%),
          linear-gradient(180deg, #07111a 0%, #050b12 100%);
        color: var(--text);
      }

      .shell {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .card {
        width: min(100%, 420px);
        border-radius: 24px;
        padding: 24px;
        background: var(--panel);
        border: 1px solid var(--panel-border);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(20px);
      }

      .eyebrow {
        letter-spacing: 0.22em;
        font-size: 12px;
        text-transform: uppercase;
        color: var(--accent);
        margin-bottom: 12px;
      }

      h1 {
        font-size: 30px;
        line-height: 1.05;
        margin: 0 0 12px;
      }

      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.5;
      }

      .status {
        margin-top: 18px;
        padding: 12px 14px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 14px;
      }

      .status strong {
        color: var(--accent-strong);
      }

      .mic {
        width: 100%;
        margin-top: 20px;
        padding: 18px 16px;
        border: none;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(65, 215, 255, 0.22), rgba(65, 215, 255, 0.12));
        color: var(--text);
        font-size: 17px;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      .mic[disabled] {
        opacity: 0.45;
      }

      .mic.active {
        background: linear-gradient(180deg, rgba(255, 107, 107, 0.28), rgba(255, 107, 107, 0.16));
      }

      .hint {
        margin-top: 14px;
        font-size: 13px;
      }

      .footer {
        margin-top: 20px;
        font-size: 12px;
        color: rgba(220, 238, 248, 0.5);
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="card">
        <div class="eyebrow">Connect Phone</div>
        <h1>Use this phone as Jarvis&apos;s mic</h1>
        <p>Join the desktop session, then tap once to start recording and tap again to send the utterance.</p>
        <div class="status" id="status">Preparing connection…</div>
        <button id="mic" class="mic" type="button" disabled>Waiting for desktop</button>
        <p class="hint" id="hint">Keep this screen open while you talk.</p>
        <div class="footer" id="footer"></div>
      </main>
    </div>

    <script>
      const params = new URLSearchParams(window.location.search);
      const pairId = params.get("pair");
      const statusEl = document.getElementById("status");
      const hintEl = document.getElementById("hint");
      const footerEl = document.getElementById("footer");
      const micButton = document.getElementById("mic");

      let ws = null;
      let mediaRecorder = null;
      let stream = null;
      let isRecording = false;
      let refCounter = 1;
      let heartbeatId = 0;

      function setStatus(message, accent) {
        statusEl.innerHTML = accent ? "<strong>" + accent + "</strong> " + message : message;
      }

      function setHint(message) {
        hintEl.textContent = message;
      }

      function setFooter(message) {
        footerEl.textContent = message;
      }

      function nextRef() {
        refCounter += 1;
        return String(refCounter);
      }

      function wsUrl() {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const query = window.location.search ? window.location.search : "";
        return protocol + "//" + window.location.host + "/socket/websocket" + query;
      }

      function send(event, payload) {
        if (!ws || ws.readyState !== WebSocket.OPEN || !pairId) return;
        ws.send(JSON.stringify([null, nextRef(), "voice_remote:" + pairId, event, payload]));
      }

      function setButtonState() {
        micButton.disabled = !ws || ws.readyState !== WebSocket.OPEN || !pairId;
        micButton.textContent = isRecording ? "Stop and send" : "Tap to talk";
        micButton.classList.toggle("active", isRecording);
      }

      function preferredMimeType() {
        const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
        for (const type of types) {
          if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) return type;
        }
        return "audio/webm";
      }

      async function blobToBase64(blob) {
        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      }

      async function ensureRecorder() {
        if (mediaRecorder) return mediaRecorder;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

        mediaRecorder = new MediaRecorder(stream, {
          mimeType: preferredMimeType(),
        });

        mediaRecorder.ondataavailable = async (event) => {
          if (!event.data || event.data.size === 0) return;
          const data = await blobToBase64(event.data);
          send("mic:chunk", {
            data,
            mimeType: event.data.type || mediaRecorder.mimeType || preferredMimeType(),
          });
        };

        mediaRecorder.onstop = () => {
          isRecording = false;
          setButtonState();
          send("mic:finish", {});
          setStatus("Utterance sent to Jarvis.", "Sent.");
          setHint("Tap again for the next utterance.");
        };

        return mediaRecorder;
      }

      async function toggleRecording() {
        if (isRecording) {
          mediaRecorder.stop();
          return;
        }

        try {
          const recorder = await ensureRecorder();
          recorder.start(250);
          isRecording = true;
          setButtonState();
          setStatus("Recording from phone mic.", "Live.");
          setHint("Tap the button again when you finish speaking.");
        } catch (error) {
          setStatus("Microphone permission failed on this phone.", "Error.");
          setHint("Allow microphone access and try again.");
        }
      }

      function connect() {
        if (!pairId) {
          setStatus("This link is missing a pairing id.", "Error.");
          setHint("Rescan the QR code from EMA.");
          return;
        }

        setFooter("Pair " + pairId.slice(0, 12));
        ws = new WebSocket(wsUrl());

        ws.addEventListener("open", () => {
          const joinRef = "1";
          ws.send(JSON.stringify([joinRef, joinRef, "voice_remote:" + pairId, "phx_join", {}]));
          send("phone:ready", { user_agent: navigator.userAgent });
          setStatus("Connected to the desktop relay.", "Ready.");
          setHint("Tap to start talking.");
          setButtonState();
          heartbeatId = window.setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify([null, nextRef(), "phoenix", "heartbeat", {}]));
            }
          }, 15000);
        });

        ws.addEventListener("message", (event) => {
          try {
            const message = JSON.parse(event.data);
            if (!Array.isArray(message) || message.length !== 5) return;
            const topic = message[2];
            const eventName = message[3];
            const payload = message[4] || {};
            if (topic !== "voice_remote:" + pairId) return;
            if (eventName === "desktop:state" && payload.state) {
              setFooter("Desktop state: " + payload.state);
            }
          } catch {
            // ignore malformed frames
          }
        });

        ws.addEventListener("close", () => {
          window.clearInterval(heartbeatId);
          heartbeatId = 0;
          setStatus("Connection closed.", "Offline.");
          setHint("Keep EMA open, then reload this page.");
          micButton.disabled = true;
        });
      }

      window.addEventListener("beforeunload", () => {
        try {
          send("phone:left", {});
        } catch {
          // ignore shutdown errors
        }
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      });

      micButton.addEventListener("click", () => {
        void toggleRecording();
      });

      connect();
      setButtonState();
    </script>
  </body>
</html>`;
}

export function registerRoutes(app: FastifyInstance): void {
  app.get(
    '/api/voice/connect-info',
    async (request: FastifyRequest<{ Querystring: ConnectInfoQuery }>, reply: FastifyReply) => {
      if (!request.query.pair_id || request.query.pair_id.trim().length < 8) {
        return reply.code(422).send({ error: 'pair_id_required' });
      }

      const urls = connectUrls(request.query.pair_id.trim());
      const preferred = urls[0] ?? withQuery(
        `http://127.0.0.1:4488/phone/voice?pair=${encodeURIComponent(request.query.pair_id.trim())}`,
        authQueryParam(),
      );
      const qrValue = encodeURIComponent(preferred);
      const qrAuth = authQueryParam();
      const qrSvgUrl = withQuery(
        `${localBase(request)}/api/voice/qr?value=${qrValue}`,
        qrAuth,
      );

      return {
        pair_id: request.query.pair_id.trim(),
        preferred_url: preferred,
        urls,
        qr_svg_url: qrSvgUrl,
      };
    },
  );

  app.get(
    '/api/voice/qr',
    async (request: FastifyRequest<{ Querystring: QrQuery }>, reply: FastifyReply) => {
      const value = request.query.value?.trim();
      if (!value) {
        return reply.code(422).send({ error: 'value_required' });
      }

      const svg = await QRCode.toString(value, {
        type: 'svg',
        margin: 1,
        width: 256,
        color: {
          dark: '#08131f',
          light: '#ffffff',
        },
      });

      return reply
        .type('image/svg+xml')
        .send(svg);
    },
  );

  app.get('/phone/voice', async (_request, reply) => {
    return reply
      .type('text/html; charset=utf-8')
      .send(renderPhonePage());
  });
}
