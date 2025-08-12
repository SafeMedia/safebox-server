import http from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import fetch, { Response as FetchResponse } from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Video.js assets locally
const videoJsCss = fs.readFileSync(
    path.join(__dirname, "node_modules", "video.js", "dist", "video-js.css"),
    "utf8"
);
const videoJsJs = fs.readFileSync(
    path.join(__dirname, "node_modules", "video.js", "dist", "video.js"),
    "utf8"
);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;
const ANTPP_ENDPOINT = process.env.ANTPP_ENDPOINT || "http://localhost:18888";
const CINEMA_MODE = process.env.CINEMA_MODE === "true";

// Valid XOR name path regex
const PATH_REGEX = /^[a-f0-9]{64}(\/[\w\-._~:@!$&'()*+,;=]+)*\/?$/i;

type FetchJob = { address: string; ws: WebSocket };
const queue: FetchJob[] = [];
let activeJobs = 0;
const MAX_CONCURRENT = 5;
const TIMEOUT_MS = 60000;

// Create HTTP server
const anttpServer = http.createServer(async (req, res) => {
    const pathReq = req.url?.slice(1); // remove leading "/"

    if (!pathReq) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("anttp server is live");
    }

    if (!PATH_REGEX.test(pathReq)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Invalid XOR name");
    }

    try {
        const cleanedPath = pathReq.startsWith("/")
            ? pathReq.slice(1)
            : pathReq;
        const antResp = await fetch(`${ANTPP_ENDPOINT}/${cleanedPath}`, {
            redirect: "follow",
        });

        if (!antResp.ok) {
            res.writeHead(antResp.status);
            return res.end(`Error fetching XOR content: ${antResp.statusText}`);
        }

        const mimeType = antResp.headers.get("content-type") || "";

        // Cinema mode for videos
        if (CINEMA_MODE && mimeType.startsWith("video/")) {
            res.writeHead(200, { "Content-Type": "text/html" });

            const videoUrl = `${ANTPP_ENDPOINT}/${cleanedPath}`;
            return res.end(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Cinema Mode</title>
<style>
${videoJsCss}
body { margin: 0; background-color: black; display: flex; align-items: center; justify-content: center; height: 100vh; }
</style>
</head>
<body>
<video id="player" class="video-js vjs-big-play-centered" controls preload="auto" style="width:90%; height:auto;">
    <source src="${videoUrl}" type="${mimeType}">
</video>
<script>
${videoJsJs}
var player = videojs('player', {
    autoplay: false,
    controls: true,
    preload: 'auto'
});
</script>
</body>
</html>
            `);
        }

        if (!antResp.body) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            return res.end("Error: Empty response body");
        }

        const headers = Object.fromEntries(antResp.headers.entries());
        res.writeHead(antResp.status, headers);
        antResp.body.pipe(res);
    } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Server error: ${err.message}`);
    }
});

anttpServer.headersTimeout = 120000;

// Attach WebSocket server
const wss = new WebSocketServer({ server: anttpServer });
console.log(`✅ WebSocket server initialized.`);

wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress || "unknown";
    console.log(`👤 Client connected from ${ip}`);

    ws.on("message", (message: string | Buffer) => {
        const address = message.toString().trim();
        console.log(`📩 Message received: ${address}`);

        if (!PATH_REGEX.test(address) || address.includes("..")) {
            return ws.send("invalid address format");
        }

        queue.push({ address, ws });
        processQueue();
    });

    ws.on("close", () => {
        console.log(`❌ Client disconnected from ${ip}`);
    });
});

anttpServer.listen(PORT, () => {
    console.log(`✅ HTTP + WebSocket server running on port ${PORT}`);
});

// Job queue processing
function processQueue() {
    if (activeJobs >= MAX_CONCURRENT || queue.length === 0) return;

    const job = queue.shift();
    if (!job) return;

    activeJobs++;

    fetchWithTimeout(`${ANTPP_ENDPOINT}/${job.address}`, TIMEOUT_MS)
        .then(async (res) => {
            if (!res.ok) throw new Error(`http ${res.status}`);

            const mimeType =
                res.headers.get("content-type") || "application/octet-stream";

            const buffer = await res.arrayBuffer();

            const metadata = JSON.stringify({
                mimeType,
                xorname: job.address,
            });
            const metadataBuffer = Buffer.from(metadata, "utf-8");

            const headerBuffer = Buffer.alloc(4);
            headerBuffer.writeUInt32BE(metadataBuffer.length, 0);

            const combined = Buffer.concat([
                headerBuffer,
                metadataBuffer,
                Buffer.from(buffer),
            ]);

            job.ws.send(combined);
        })
        .catch((err) => {
            console.error(`❌ Error fetching from ANTPP: ${err.message}`);
            job.ws.send(`error fetching: ${err.message}`);
        })
        .finally(() => {
            activeJobs--;
            processQueue();
        });
}

// Fetch with timeout helper
async function fetchWithTimeout(
    url: string,
    timeoutMs: number
): Promise<FetchResponse> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
}
