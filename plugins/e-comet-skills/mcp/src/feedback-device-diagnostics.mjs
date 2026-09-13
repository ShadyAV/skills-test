const STATES = new Set(['passed', 'failed', 'unknown', 'not_checked', 'unsupported']);
const MAX_TEXT_LENGTH = 128;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= MAX_TEXT_LENGTH
    && !/[\u0000-\u001f\u007f]/u.test(value) ? value : undefined;
const iso = value => {
    if (typeof value !== 'string' || value.length !== 24 || !ISO_RE.test(value)) return undefined;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString() === value ? value : undefined;
};
const compact = value => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
const bool = value => typeof value === 'boolean' ? value : undefined;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0 ? value : undefined;

const storageTarget = value => {
    if (!record(value)) return undefined;
    if (value.state === 'ready' && ['plugin_data', 'application_data', 'override'].includes(value.backend))
        return { state: 'ready', backend: value.backend };
    if (value.state === 'unavailable' && ['plugin_data_missing', 'plugin_data_invalid', 'plugin_data_conflict', 'application_data_invalid', 'override_invalid'].includes(value.reason))
        return { state: 'unavailable', reason: value.reason };
    return undefined;
};

const specs = {
    bridgeStatusCollection: { check: 'bridge_status_collection', source: 'feedback_preparation', planes: ['device'], causes: ['permission_denied', 'unknown'] },
    snapshot: { check: 'snapshot', source: 'local_bridge_status', planes: ['device'], causes: ['unknown'] },
    runtime: { check: 'runtime', source: 'node_process', planes: ['device'], causes: ['unknown'], facts: value => {
        if (!record(value)) return undefined;
        const core = { nodeVersion: text(value.nodeVersion), platform: text(value.platform), arch: text(value.arch), bridgeVersion: text(value.bridgeVersion) };
        if (Object.values(core).some(item => item === undefined)) return undefined;
        return compact({ ...core, mcpProtocolVersion: text(value.mcpProtocolVersion) });
    } },
    client: { check: 'client', source: 'mcp_initialize', planes: ['client'], causes: ['unknown'], facts: value =>
        record(value) && value.provenance === 'client_reported' ? { provenance: 'client_reported' } : undefined },
    listener: { check: 'listener', source: 'bridge_runtime', planes: ['device'], causes: ['address_in_use', 'listen_failed', 'unknown'], facts: value => {
        if (!record(value) || value.operation !== 'bind_listener' || !['pending', 'listening', 'address_in_use', 'failed'].includes(value.listenerState)) return undefined;
        return compact({ operation: 'bind_listener', listenerState: value.listenerState,
            systemCode: ['EACCES', 'EPERM', 'EADDRINUSE', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EINVAL'].includes(value.systemCode) ? value.systemCode : undefined });
    } },
    pairingSource: { check: 'pairing_source', source: 'peer_token_source', planes: ['device'], causes: ['permission_denied', 'insecure_permissions', 'missing', 'corrupt', 'unsupported', 'io_error'] },
    routeFreshness: { check: 'route_freshness', source: 'extension_heartbeat', planes: ['device', 'peer'], causes: ['unknown'], facts: value => {
        const lastObservedAt = record(value) ? iso(value.lastObservedAt) : undefined;
        return lastObservedAt ? { lastObservedAt } : undefined;
    } },
    storage: { check: 'storage', source: 'resolved_configuration', planes: ['device'], causes: ['unknown'], facts: value => {
        if (!record(value) || value.scope !== 'configuration' || !record(value.targets)) return undefined;
        const targets = compact({ results: storageTarget(value.targets.results), marketplaceArtifacts: storageTarget(value.targets.marketplaceArtifacts),
            feedbackArtifacts: storageTarget(value.targets.feedbackArtifacts) });
        return Object.keys(targets).length ? { scope: 'configuration', targets } : undefined;
    } },
};

export const feedbackDeviceDiagnosticsFailure = (error, now = Date.now) => ({
    bridgeStatusCollection: {
        check: 'bridge_status_collection', state: 'failed', observedAt: new Date(now()).toISOString(),
        source: 'feedback_preparation', executionPlane: 'device',
        cause: ['EACCES', 'EPERM'].includes(error?.code) ? 'permission_denied' : 'unknown',
    },
});

const selectCheck = (slot, value) => {
    const spec = specs[slot];
    if (!spec || !record(value) || value.check !== spec.check || !STATES.has(value.state)
        || value.source !== spec.source || !spec.planes.includes(value.executionPlane)) return undefined;
    const observedAt = iso(value.observedAt);
    if (!observedAt) return undefined;
    const cause = value.cause === undefined ? undefined : spec.causes.includes(value.cause) ? value.cause : null;
    if (cause === null) return undefined;
    const facts = spec.facts?.(value.facts);
    return compact({ check: spec.check, state: value.state, observedAt, source: spec.source,
        executionPlane: value.executionPlane, cause, ...(facts && Object.keys(facts).length ? { facts } : {}) });
};

export const selectFeedbackDeviceDiagnostics = value => {
    if (!record(value)) return undefined;
    const selected = {};
    for (const slot of Object.keys(specs)) {
        const check = selectCheck(slot, value[slot]);
        if (check) selected[slot] = check;
    }
    return Object.keys(selected).length ? selected : undefined;
};

const bridgeStates = new Set(['initializing', 'listen_failed', 'waiting_for_extension', 'extension_connected_no_wb_tab', 'extension_contended', 'extension_context_unknown', 'peer_context_unknown', 'ready', 'extension_update_required', 'peer_reconnecting', 'peer_unavailable']);
const peerRejectionCodes = new Set(Object.values(PEER_REJECTION_CODES));
const selectStorage = storage => {
    if (!record(storage)) return undefined;
    const selected = compact({ results: storageTarget(storage.results), marketplaceArtifacts: storageTarget(storage.marketplaceArtifacts),
        feedbackArtifacts: storageTarget(storage.feedbackArtifacts) });
    return Object.keys(selected).length ? selected : undefined;
};

export const selectFeedbackDeviceSnapshot = status => {
    if (!record(status)) return {};
    const extension = record(status.extension) ? compact({
            state: ['never_connected', 'connected', 'disconnected'].includes(status.extension.state) ? status.extension.state : undefined,
            route: ['direct', 'peer', 'none'].includes(status.extension.route) ? status.extension.route : undefined, version: text(status.extension.version),
            lastConnectedAt: iso(status.extension.lastConnectedAt), lastDisconnectedAt: iso(status.extension.lastDisconnectedAt),
            ozonSellerPromotionReportSupported: bool(status.extension.ozonSellerPromotionReportSupported),
            ozonSellerPromotionReportsSupported: bool(status.extension.ozonSellerPromotionReportsSupported),
            ozonSellerAnalyticsReportSupported: bool(status.extension.ozonSellerAnalyticsReportSupported),
        }) : undefined;
    const peer = record(status.peer) ? compact({ bridgeVersion: text(status.peer.bridgeVersion),
        browserContextPropagationSupported: bool(status.peer.browserContextPropagationSupported) }) : undefined;
    const browserContext = record(status.browserContext) && ['unknown', 'known'].includes(status.browserContext.state) ? compact({
        state: status.browserContext.state, wbTabConnected: bool(status.browserContext.wbTabConnected),
        sellerTabConnected: bool(status.browserContext.sellerTabConnected),
    }) : undefined;
    return compact({
        bridgeStatusCollection: status.bridgeStatusCollection?.check === 'bridge_status_collection'
            ? selectCheck('bridgeStatusCollection', status.bridgeStatusCollection) : undefined,
        bridgeVersion: text(status.bridgeVersion), bridgeGeneration: positiveInteger(status.bridgeGeneration),
        controlProtocolVersion: positiveInteger(status.controlProtocolVersion), extensionProtocolVersion: positiveInteger(status.extensionProtocolVersion),
        state: bridgeStates.has(status.state) ? status.state : undefined,
        extension: extension && Object.keys(extension).length ? extension : undefined, peer: peer && Object.keys(peer).length ? peer : undefined,
        peerRejection: peerRejectionCodes.has(status.peerRejection?.code) ? { code: status.peerRejection.code } : undefined,
        browserContext, storage: selectStorage(status.storage), diagnostics: selectFeedbackDeviceDiagnostics(status.diagnostics),
    });
};

export const isValidFeedbackDeviceSnapshot = value => {
    if (!record(value)) return false;
    const selected = selectFeedbackDeviceSnapshot(value);
    if (!isValidFeedbackDeviceDiagnostics(value.diagnostics)) return false;
    if (value.extension !== undefined && (!record(value.extension) || value.extension.state === undefined || value.extension.route === undefined)) return false;
    if (value.storage !== undefined && (!record(value.storage) || !['results', 'marketplaceArtifacts', 'feedbackArtifacts'].every(key => Object.hasOwn(value.storage, key)))) return false;
    return Object.keys(selected).length > 0 && exact(value, selected) && Buffer.byteLength(JSON.stringify(value), 'utf8') <= 8192;
};

const exact = (left, right) => {
    if (left === right) return true;
    if (!record(left) || !record(right)) return false;
    const leftKeys = Object.keys(left); const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length && leftKeys.every(key => Object.hasOwn(right, key) && exact(left[key], right[key]));
};

export const isValidFeedbackDeviceDiagnostics = value => {
    const selected = selectFeedbackDeviceDiagnostics(value);
    return selected !== undefined && exact(value, selected) && Buffer.byteLength(JSON.stringify(value), 'utf8') <= 4096;
};

const diagnosticString = { type: 'string', minLength: 1, maxLength: MAX_TEXT_LENGTH };
const diagnosticTimestamp = { type: 'string', minLength: 24, maxLength: 24, pattern: ISO_RE.source };
const diagnosticObject = (properties, required) => ({ type: 'object', properties, required, additionalProperties: false });
const checkSchema = (check, source, planes, facts, causes) => diagnosticObject({
    check: { const: check }, state: { type: 'string', enum: [...STATES] }, observedAt: diagnosticTimestamp,
    source: { const: source }, executionPlane: { type: 'string', enum: planes },
    ...(facts ? { facts } : {}), cause: { type: 'string', enum: causes },
}, ['check', 'state', 'observedAt', 'source', 'executionPlane']);
const storageTargetSchema = { type: 'object', oneOf: [
    diagnosticObject({ state: { const: 'ready' }, backend: { type: 'string', enum: ['plugin_data', 'application_data', 'override'] } }, ['state', 'backend']),
    diagnosticObject({ state: { const: 'unavailable' }, reason: { type: 'string', enum: ['plugin_data_missing', 'plugin_data_invalid', 'plugin_data_conflict', 'application_data_invalid', 'override_invalid'] } }, ['state', 'reason']),
] };
export const feedbackDeviceDiagnosticsSchema = diagnosticObject({
    bridgeStatusCollection: checkSchema('bridge_status_collection', 'feedback_preparation', ['device'], undefined, ['permission_denied', 'unknown']),
    snapshot: checkSchema('snapshot', 'local_bridge_status', ['device'], undefined, ['unknown']),
    runtime: checkSchema('runtime', 'node_process', ['device'], diagnosticObject({ nodeVersion: diagnosticString, platform: diagnosticString,
        arch: diagnosticString, bridgeVersion: diagnosticString, mcpProtocolVersion: diagnosticString }, ['nodeVersion', 'platform', 'arch', 'bridgeVersion']), ['unknown']),
    client: checkSchema('client', 'mcp_initialize', ['client'], diagnosticObject({ provenance: { const: 'client_reported' } }, ['provenance']), ['unknown']),
    listener: checkSchema('listener', 'bridge_runtime', ['device'], diagnosticObject({ operation: { const: 'bind_listener' },
        listenerState: { type: 'string', enum: ['pending', 'listening', 'address_in_use', 'failed'] },
        systemCode: { type: 'string', enum: ['EACCES', 'EPERM', 'EADDRINUSE', 'EADDRNOTAVAIL', 'EAFNOSUPPORT', 'EINVAL'] } }, ['operation', 'listenerState']), ['address_in_use', 'listen_failed', 'unknown']),
    pairingSource: checkSchema('pairing_source', 'peer_token_source', ['device'], undefined, ['permission_denied', 'insecure_permissions', 'missing', 'corrupt', 'unsupported', 'io_error']),
    routeFreshness: checkSchema('route_freshness', 'extension_heartbeat', ['device', 'peer'], diagnosticObject({ lastObservedAt: diagnosticTimestamp }, ['lastObservedAt']), ['unknown']),
    storage: checkSchema('storage', 'resolved_configuration', ['device'], diagnosticObject({ scope: { const: 'configuration' },
        targets: diagnosticObject({ results: storageTargetSchema, marketplaceArtifacts: storageTargetSchema, feedbackArtifacts: storageTargetSchema }, []) }, ['scope', 'targets']), ['unknown']),
}, []);

export const feedbackDeviceSnapshotSchema = diagnosticObject({
    bridgeStatusCollection: feedbackDeviceDiagnosticsSchema.properties.bridgeStatusCollection,
    bridgeVersion: diagnosticString,
    bridgeGeneration: { type: 'integer', minimum: 1 }, controlProtocolVersion: { type: 'integer', minimum: 1 }, extensionProtocolVersion: { type: 'integer', minimum: 1 },
    state: { type: 'string', enum: [...bridgeStates] },
    extension: diagnosticObject({ state: { type: 'string', enum: ['never_connected', 'connected', 'disconnected'] }, route: { type: 'string', enum: ['direct', 'peer', 'none'] },
        version: diagnosticString, lastConnectedAt: diagnosticTimestamp, lastDisconnectedAt: diagnosticTimestamp,
        ozonSellerPromotionReportSupported: { type: 'boolean' }, ozonSellerPromotionReportsSupported: { type: 'boolean' }, ozonSellerAnalyticsReportSupported: { type: 'boolean' } }, ['state', 'route']),
    peer: diagnosticObject({ bridgeVersion: diagnosticString, browserContextPropagationSupported: { type: 'boolean' } }, []),
    peerRejection: diagnosticObject({ code: { type: 'string', enum: [...peerRejectionCodes] } }, ['code']),
    browserContext: diagnosticObject({ state: { type: 'string', enum: ['unknown', 'known'] }, wbTabConnected: { type: 'boolean' }, sellerTabConnected: { type: 'boolean' } }, ['state']),
    storage: diagnosticObject({ results: storageTargetSchema, marketplaceArtifacts: storageTargetSchema, feedbackArtifacts: storageTargetSchema }, []),
    diagnostics: feedbackDeviceDiagnosticsSchema,
}, []);
import { PEER_REJECTION_CODES } from './connection-state.mjs';
