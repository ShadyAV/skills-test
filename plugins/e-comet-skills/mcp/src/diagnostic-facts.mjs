export const DIAGNOSTIC_STATES = Object.freeze(['passed', 'failed', 'unknown', 'not_checked', 'unsupported']);
export const DIAGNOSTIC_CAUSES = Object.freeze(['permission_denied', 'insecure_permissions', 'missing', 'directory_absent', 'corrupt', 'unsupported', 'io_error', 'address_in_use', 'listen_failed', 'unavailable', 'unknown']);

const safeText = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(value);

export const sanitizeClientInfo = (value) => value && safeText(value.name) && safeText(value.version)
    ? Object.freeze({ name: value.name, version: value.version }) : null;

export const diagnosticCheck = (/** @type {any} */ input) => {
    const { check, state, observedAt, source, executionPlane, facts, cause, evidenceRefs, nextCheck } = input;
    if (!DIAGNOSTIC_STATES.includes(state)) throw new TypeError(`Unrecognized diagnostic state: ${state}`);
    if (cause !== undefined && !DIAGNOSTIC_CAUSES.includes(cause)) throw new TypeError(`Unrecognized diagnostic cause: ${cause}`);
    return Object.freeze({ check, state, observedAt, source, executionPlane,
        ...(facts === undefined ? {} : { facts: Object.freeze(facts) }),
        ...(cause === undefined ? {} : { cause }),
        ...(evidenceRefs === undefined ? {} : { evidenceRefs: Object.freeze([...evidenceRefs]) }),
        ...(nextCheck === undefined ? {} : { nextCheck }),
    });
};

export const collectStaticFacts = (/** @type {any} */ input) => {
    const { platform, arch, versions = {}, storageLayout = {}, pairingObservation, observedAt = new Date().toISOString() } = input;
    const checks = [
        diagnosticCheck({ check: 'runtime', state: 'passed', observedAt, source: 'node_process', executionPlane: 'device', facts: {
            nodeVersion: versions.node, platform, arch, ...(versions.bridge ? { bridgeVersion: versions.bridge } : {}),
            ...(versions.mcp ? { mcpProtocolVersion: versions.mcp } : {}),
        } }),
        diagnosticCheck({ check: 'storage', state: 'passed', observedAt, source: 'resolved_configuration', executionPlane: 'device', facts: {
            scope: 'configuration', targets: Object.fromEntries(Object.entries(storageLayout).map(([name, target]) => [name,
                target?.state === 'ready' ? { state: 'ready', backend: target.backend } : { state: 'unavailable', reason: target?.reason ?? 'invalid_path' }
            ])),
        } }),
    ];
    if (pairingObservation) checks.push(diagnosticCheck({ check: 'pairing_source', state: pairingObservation.state === 'passed' ? 'passed' : 'failed', observedAt: pairingObservation.observedAt ?? observedAt,
        source: 'peer_token_source', executionPlane: 'device', ...(pairingObservation.reason ? { cause: pairingObservation.reason } : {}) }));
    return checks;
};
