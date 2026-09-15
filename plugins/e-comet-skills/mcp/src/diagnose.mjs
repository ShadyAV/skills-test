import fs from 'node:fs/promises';
import { join } from 'node:path';
import { diagnosticCheck } from './diagnostic-facts.mjs';
import { collectDoctorReport } from './doctor.mjs';
import { collectCodexHookPermissions } from './codex-hook-permissions.mjs';

const systemCause = (error) => ['EACCES', 'EPERM', 'EROFS'].includes(error?.code) ? 'permission_denied' : 'io_error';
const step = (operation, state, systemCode, reason) => ({ operation, state, ...(systemCode ? { systemCode } : {}), ...(reason ? { reason } : {}) });

const probeStorageTarget = async (name, target, { observedAt, randomUUID, fileSystem }) => {
    const base = { check: 'storage_write', observedAt, source: 'safe_probe', executionPlane: 'device' };
    if (target?.state !== 'ready') return diagnosticCheck({ ...base, state: 'not_checked', cause: 'unknown', facts: { target: name, steps: [] } });
    try {
        if (!(await fileSystem.stat(target.path)).isDirectory()) return diagnosticCheck({ ...base, state: 'not_checked', cause: 'directory_absent', facts: { target: name, steps: [] } });
    } catch (error) {
        if (error?.code === 'ENOENT') return diagnosticCheck({ ...base, state: 'not_checked', cause: 'directory_absent', facts: { target: name, steps: [] } });
        return diagnosticCheck({ ...base, state: 'failed', cause: systemCause(error), facts: { target: name, steps: [] } });
    }
    const path = join(target.path, `.e-comet-diagnostic-${randomUUID()}.tmp`);
    const payload = Buffer.from('e-comet-safe-probe\n');
    const steps = [];
    let handle;
    let failure;
    let acquired = false;
    let identity;
    try {
        try {
            handle = await fileSystem.open(path, 'wx');
            acquired = true;
            steps.push(step('create', 'passed'));
            try { identity = await handle.stat(); }
            catch (error) { steps.push(step('identify', 'failed', error?.code)); failure = error; }
        }
        catch (error) { steps.push(step('create', 'failed', error?.code)); failure = error; }
        if (identity) {
            try { await handle.writeFile(payload); steps.push(step('write', 'passed')); }
            catch (error) { steps.push(step('write', 'failed', error?.code)); failure = error; }
        }
        if (identity && !failure) {
            try { const read = await fileSystem.readFile(path); if (!read.equals(payload)) throw Object.assign(new Error('mismatch'), { code: 'EIO' }); steps.push(step('read', 'passed')); }
            catch (error) { steps.push(step('read', 'failed', error?.code)); failure = error; }
        }
    } finally {
        if (acquired) {
            let sameFile = false;
            if (identity) {
                try { const current = await fileSystem.stat(path); sameFile = current.dev === identity.dev && current.ino === identity.ino; }
                catch (error) { steps.push(step('remove', 'failed', error?.code)); failure ??= error; }
            }
            try { await handle.close(); }
            catch (error) { steps.push(step('close', 'failed', error?.code)); failure ??= error; }
            if (!identity) {
                // Accepted residual: the tiny probe file may remain because no existing store sweep owns its grammar.
                // See docs/local-agent-architecture.md#accepted-residuals.
                steps.push(step('remove', 'not_checked', undefined, 'identity_unavailable'));
            } else if (!sameFile && !steps.some(({ operation }) => operation === 'remove')) {
                const error = Object.assign(new Error('probe file identity changed'), { code: 'IDENTITY_CHANGED' });
                steps.push(step('remove', 'failed', error.code)); failure ??= error;
            } else if (sameFile) {
                try { await fileSystem.unlink(path); steps.push(step('remove', 'passed')); }
                catch (error) { steps.push(step('remove', 'failed', error?.code)); failure ??= error; }
            }
        }
    }
    return diagnosticCheck({ ...base, state: failure ? 'failed' : 'passed', ...(failure ? { cause: systemCause(failure) } : {}), facts: { target: name, steps } });
};

export const collectDiagnosis = async (/** @type {any} */ { scope, mode, operationHandle, operationDiagnostics, getBridgeStatus,
    requestExtensionDiagnosticSnapshot,
    storageLayout = {}, probes = [], now = Date.now, randomUUID = () => globalThis.crypto.randomUUID(), collectInstallation = collectDoctorReport,
    collectHookPermissions = collectCodexHookPermissions,
    fileSystem = fs } = {}) => {
    const observedAt = new Date(now()).toISOString();
    let checks = [];
    let operation;
    if (scope === 'installation') checks = [...(await collectInstallation({ observedAt })).checks];
    else if (scope === 'runtime') {
        try { checks = Object.values(getBridgeStatus?.()?.diagnostics ?? {}); }
        catch { checks = [diagnosticCheck({ check: 'runtime_snapshot', state: 'failed', observedAt, source: 'local_bridge_status', executionPlane: 'device', cause: 'unknown' })]; }
    } else if (scope === 'last_operation') {
        operation = operationDiagnostics?.read(operationHandle) ?? undefined;
        checks = [diagnosticCheck({ check: 'operation_receipt', state: operation ? 'passed' : 'unknown', observedAt, source: 'process_memory', executionPlane: 'device' })];
    }
    if (mode === 'safe_probes') {
        if (scope === 'installation' && probes.includes('storage_write')) for (const [name, target] of Object.entries(storageLayout)) checks.push(await probeStorageTarget(name, target, { observedAt, randomUUID, fileSystem }));
        if (scope === 'installation' && probes.includes('hook_permissions')) checks.push(await collectHookPermissions({ now }));
        if (scope === 'runtime' && probes.includes('extension_snapshot')) {
            try {
                const facts = await requestExtensionDiagnosticSnapshot?.();
                checks.push(facts
                    ? diagnosticCheck({ check: 'extension_snapshot', state: 'passed', observedAt: facts.observedAt, source: 'extension', executionPlane: 'device', facts })
                    : diagnosticCheck({ check: 'extension_snapshot', state: 'unsupported', observedAt, source: 'capability_negotiation', executionPlane: 'device', cause: 'unsupported' }));
            } catch (error) {
                checks.push(diagnosticCheck({ check: 'extension_snapshot', state: error?.code === 'UNSUPPORTED_CAPABILITY' ? 'unsupported' : 'failed', observedAt,
                    source: 'extension', executionPlane: 'device', cause: error?.code === 'UNSUPPORTED_CAPABILITY' ? 'unsupported' : 'unknown' }));
            }
        }
    }
    if (scope === 'runtime') checks.push(diagnosticCheck({ check: 'host_hook_context', state: 'not_checked', observedAt,
        source: 'device_process', executionPlane: 'device', cause: 'unavailable' }));
    return { schemaVersion: 1, scope, mode, checks, ...(operation ? { operation } : {}) };
};
