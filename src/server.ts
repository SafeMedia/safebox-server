import http from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import fetch, { Response as FetchResponse } from "node-fetch";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;
const ANTPP_ENDPOINT = process.env.ANTPP_ENDPOINT || "http://localhost:18888";

// this allows paths like: abcdef...64/filename.png or deeper (e.g. /images/file.png)
const PATH_REGEX = /^[a-f0-9]{64}(\/[\w\-._~:@!$&'()*+,;=]+)*\/?$/i;

type FetchJob = { address: string; ws: WebSocket };
const queue: FetchJob[] = [];
let activeJobs = 0;
const MAX_CONCURRENT = 5;
const TIMEOUT_MS = 60000;

// create HTTP server
const anttpServer = http.createServer(async (req, res) => {
    const path = req.url?.slice(1); // remove leading "/"

    // If root, respond with default message
    if (!path) {
        res.writeHead(200, { "Content-Type": "text/plain" });
        return res.end("anttp server is live");
    }

    // Validate path is a valid XOR name + optional deeper path + optional trailing slash
    if (!PATH_REGEX.test(path)) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        return res.end("Invalid XOR name");
    }

    try {
        // Proxy GET request to Rust antTP server on port 18888
        const cleanedPath = path.startsWith("/") ? path.slice(1) : path;
        const antResp = await fetch(`${ANTPP_ENDPOINT}/${cleanedPath}`, {
            redirect: "follow",
        });

        if (!antResp.ok) {
            res.writeHead(antResp.status);
            return res.end(`Error fetching XOR content: ${antResp.statusText}`);
        }

        if (!antResp.body) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            return res.end("Error: Empty response body");
        }

        // Forward status code and content-type header from Rust server
        const headers = Object.fromEntries(antResp.headers.entries());
        res.writeHead(antResp.status, headers);
        antResp.body.pipe(res);
    } catch (err: any) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(`Server error: ${err.message}`);
    }
});

// start server
anttpServer.headersTimeout = 120000; // 120 seconds (2 minutes)

// attach WebSocket server
const wss = new WebSocketServer({ server: anttpServer });
console.log(`✅ WebSocket server initialized.`);

// handle new connections
wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress || "unknown";
    console.log(`👤 Client connected from ${ip}`);

    ws.on("message", (message: string | Buffer) => {
        const address = message.toString().trim();
        console.log(`📩 Message received: ${address}`);

        // Basic validation: regex + no ".."
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

// main job processing loop
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

            console.log("mimeType: ", mimeType);
            console.log("res: ", res);

            const buffer = await res.arrayBuffer();

            // prepare JSON metadata
            const metadata = JSON.stringify({
                mimeType,
                xorname: job.address,
            });
            const metadataBuffer = Buffer.from(metadata, "utf-8");

            // 4-byte header for metadata length
            const headerBuffer = Buffer.alloc(4);
            headerBuffer.writeUInt32BE(metadataBuffer.length, 0);

            // final payload: [header][metadata][binary]
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

// fetch helper with timeout
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
