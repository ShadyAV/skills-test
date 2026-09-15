import { spawn } from 'node:child_process';

const MAX_PROTOCOL_BYTES = 1024 * 1024;
const protocolError = (message) => Object.assign(new Error(message), { code: 'CODEX_APP_SERVER_PROTOCOL' });

// A bounded JSON-RPC request. Each query owns and closes its inspector process.
export const queryCodexAppServer = ({ args, method, params, timeoutMs, spawnProcess = spawn, clientName }) => new Promise((resolve, reject) => {
    let child;
    try { child = spawnProcess('codex', ['app-server', ...args], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }); }
    catch (error) { reject(error); return; }
    let buffer = '';
    let settled = false;
    const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { child.kill(); } catch { /* best effort */ }
        if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error(`${method} timed out`)), timeoutMs);
    child.on('error', (error) => finish(error));
    child.stdin.on('error', (error) => finish(error));
    child.stdout.on('error', (error) => finish(error));
    child.on('close', () => finish(new Error(`app-server closed before ${method}`)));
    child.stdout.on('data', (chunk) => {
        if (settled) return;
        buffer += chunk;
        if (Buffer.byteLength(buffer) > MAX_PROTOCOL_BYTES) { finish(protocolError(`${method} response too large`)); return; }
        for (;;) {
            const newline = buffer.indexOf('\n');
            if (newline < 0 || settled) break;
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            let response;
            try { response = JSON.parse(line); } catch { continue; }
            if (response.id === 1) {
                if (response.error) { finish(protocolError('initialize failed')); return; }
                child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
                child.stdin.write(`${JSON.stringify({ id: 2, method, params })}\n`);
            } else if (response.id === 2) {
                if (response.error) finish(protocolError(`${method} failed`));
                else finish(undefined, response.result);
            }
        }
    });
    child.stdin.write(`${JSON.stringify({ id: 1, method: 'initialize', params: {
        clientInfo: { name: clientName, version: '1' }, capabilities: { experimentalApi: true },
    } })}\n`);
});

export const withCodexAppServer = async ({ method, params, proxyTimeoutMs, inspectorTimeoutMs, spawnProcess = spawn, clientName }) => {
    try {
        return { result: await queryCodexAppServer({ args: ['proxy'], method, params, timeoutMs: proxyTimeoutMs, spawnProcess, clientName }),
            inspector: 'connected_config_reader' };
    } catch {
        return { result: await queryCodexAppServer({ args: ['--stdio'], method, params, timeoutMs: inspectorTimeoutMs, spawnProcess, clientName }),
            inspector: 'transient_config_reader' };
    }
};
