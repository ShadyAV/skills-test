import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { diagnosticCheck } from './diagnostic-facts.mjs';
import { hookPermissionsFactsSchema, validateSchemaValue } from './tool-schemas.mjs';

const PLUGIN_ID = 'e-comet-skills';
const MAX_PROTOCOL_BYTES = 1024 * 1024;
const EXPECTED_HOOKS = new Set([
    'preToolUse:browser_authorization_restore', 'preToolUse:update_check', 'preToolUse:feedback_authorization_restore',
    'preToolUse:feedback_cloud_processing', 'postToolUse:browser_authorization_capture',
    'postToolUse:feedback_authorization_capture', 'postToolUse:feedback_cloud_processing',
]);
const isPluginHook = (hook) => hook?.pluginId === PLUGIN_ID || hook?.pluginId?.startsWith(`${PLUGIN_ID}@`);
const hookFamily = (hook) => {
    const key = `${hook?.eventName}:${hook?.statusMessage}`;
    const families = {
        'preToolUse:Restoring e-Comet browser authorization': 'browser_authorization_restore',
        'postToolUse:Securing e-Comet browser authorization': 'browser_authorization_capture',
        'preToolUse:Checking e-Comet MCP Tools plugin version': 'update_check',
        'preToolUse:Restoring e-Comet feedback authorization': 'feedback_authorization_restore',
        'postToolUse:Securing e-Comet feedback authorization': 'feedback_authorization_capture',
        'preToolUse:Processing e-Comet cloud feedback': 'feedback_cloud_processing',
        'postToolUse:Processing e-Comet cloud feedback': 'feedback_cloud_processing',
        'postToolUseFailure:Checking e-Comet preparation failure': 'feedback_failure_recovery',
    };
    if (Object.hasOwn(families, key)) return families[key];
    return 'plugin_hook';
};

const queryHooks = ({ args, cwd, timeoutMs, spawnProcess }) => new Promise((resolve, reject) => {
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
    const timer = setTimeout(() => finish(new Error('hooks/list timed out')), timeoutMs);
    child.on('error', (error) => finish(error));
    child.stdin.on('error', (error) => finish(error));
    child.stdout.on('error', (error) => finish(error));
    child.on('close', () => finish(new Error('app-server closed before hooks/list')));
    child.stdout.on('data', (chunk) => {
        buffer += chunk;
        if (buffer.length > MAX_PROTOCOL_BYTES) { finish(new Error('hooks/list response too large')); return; }
        for (;;) {
            const newline = buffer.indexOf('\n');
            if (newline < 0) break;
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            let response;
            try { response = JSON.parse(line); } catch { continue; }
            if (response.id === 1) {
                if (response.error) { finish(new Error('initialize failed')); return; }
                child.stdin.write(`${JSON.stringify({ method: 'initialized' })}\n`);
                child.stdin.write(`${JSON.stringify({ id: 2, method: 'hooks/list', params: { cwds: [cwd] } })}\n`);
            } else if (response.id === 2) {
                if (response.error) finish(new Error('hooks/list failed'));
                else finish(undefined, response.result);
            }
        }
    });
    child.stdin.write(`${JSON.stringify({ id: 1, method: 'initialize', params: {
        clientInfo: { name: 'e-comet-hook-permissions', version: '1' }, capabilities: { experimentalApi: true },
    } })}\n`);
});

const samePath = (left, right) => {
    try { return process.platform === 'win32' ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right); }
    catch { return false; }
};
export const summarizeCodexHooks = (result, cwd, inspector = 'connected_config_reader') => {
    const matching = Array.isArray(result?.data) ? result.data.filter((entry) => samePath(entry?.cwd, cwd)) : [];
    if (matching.length !== 1) return { state: 'unknown', cause: 'unknown', facts: {
        host: 'codex', context: 'configuration_snapshot', configured: 0, enabled: 0,
        trust: { trusted: 0, untrusted: 0, modified: 0, managed: 0 }, hooks: [], warnings: false, errors: true, status: 'incomplete_inventory', inspector,
        installationMatch: 'not_verified', currentApplicationMatch: 'not_verified',
    } };
    const entries = matching;
    const hooks = entries.flatMap((entry) => Array.isArray(entry?.hooks) ? entry.hooks : []).filter(isPluginHook);
    const warnings = entries.some((entry) => Array.isArray(entry?.warnings) && entry.warnings.length > 0);
    const errors = entries.some((entry) => Array.isArray(entry?.errors) && entry.errors.length > 0);
    const trust = { trusted: 0, untrusted: 0, modified: 0, managed: 0 };
    for (const hook of hooks) {
        if (hook?.isManaged || hook?.trustStatus === 'managed') trust.managed += 1;
        else if (Object.hasOwn(trust, hook?.trustStatus)) trust[hook.trustStatus] += 1;
    }
    const enabled = hooks.filter((hook) => hook?.enabled === true).length;
    const safeHooks = hooks.map((hook) => ({ eventName: ['preToolUse', 'postToolUse', 'postToolUseFailure'].includes(hook?.eventName) ? hook.eventName : 'unknown', family: hookFamily(hook), enabled: hook.enabled === true,
        trustStatus: hook?.isManaged || hook?.trustStatus === 'managed' ? 'managed'
            : ['trusted', 'untrusted', 'modified'].includes(hook?.trustStatus) ? hook.trustStatus : 'unknown' }));
    const base = { host: 'codex', context: 'configuration_snapshot', configured: hooks.length, enabled, trust, hooks: safeHooks, warnings, errors, inspector,
        installationMatch: 'not_verified', currentApplicationMatch: 'not_verified' };
    const observedKeys = safeHooks.map((hook) => `${hook.eventName}:${hook.family}`);
    const missing = [...EXPECTED_HOOKS].filter((key) => !observedKeys.includes(key));
    const duplicate = observedKeys.some((key, index) => observedKeys.indexOf(key) !== index);
    if (errors || warnings) return { state: 'unknown', cause: 'unknown', facts: { ...base, status: 'incomplete_inventory' } };
    if (hooks.length === 0) return { state: 'failed', cause: 'missing', facts: { ...base, status: 'missing' } };
    if (missing.length > 0 || duplicate || safeHooks.some(({ family, trustStatus }) => family === 'plugin_hook' || trustStatus === 'unknown'))
        return { state: 'unknown', cause: 'unknown', facts: { ...base, status: 'incomplete_inventory', missing } };
    if (enabled !== hooks.length) return { state: 'failed', cause: 'permission_denied', facts: { ...base, status: 'disabled' } };
    if (trust.untrusted > 0 || trust.modified > 0) return { state: 'failed', cause: 'permission_denied', facts: { ...base, status: 'review_required' } };
    if (trust.trusted + trust.managed !== hooks.length) return { state: 'unknown', cause: 'unsupported', facts: { ...base, status: 'unsupported' } };
    return { state: 'passed', facts: { ...base, status: 'ready' } };
};

export const collectCodexHookPermissions = async (/** @type {any} */ { cwd = process.cwd(), observedAt, now = Date.now,
    timeoutMs = 2_000, spawnProcess = spawn } = {}) => {
    let result;
    let inspector = 'connected_config_reader';
    try { result = await queryHooks({ args: ['proxy'], cwd, timeoutMs, spawnProcess }); }
    catch {
        inspector = 'transient_config_reader';
        try { result = await queryHooks({ args: ['--stdio'], cwd, timeoutMs, spawnProcess }); }
        catch { return diagnosticCheck({ check: 'hook_permissions', state: 'not_checked', observedAt: observedAt ?? new Date(now()).toISOString(),
            source: 'codex_hooks_list', executionPlane: 'device', cause: 'unavailable' }); }
    }
    const summary = summarizeCodexHooks(result, cwd, inspector);
    if (summary.facts && !validateSchemaValue(summary.facts, hookPermissionsFactsSchema)) return diagnosticCheck({ check: 'hook_permissions',
        state: 'unknown', observedAt: observedAt ?? new Date(now()).toISOString(), source: 'codex_hooks_list', executionPlane: 'device', cause: 'unknown' });
    return diagnosticCheck({ check: 'hook_permissions', observedAt: observedAt ?? new Date(now()).toISOString(), source: 'codex_hooks_list', executionPlane: 'device', ...summary });
};
