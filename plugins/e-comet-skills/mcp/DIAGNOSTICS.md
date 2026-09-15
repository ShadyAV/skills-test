# `local_bridge_status` technical reference

`local_bridge_status` is a passive snapshot. It does not start a listener, create or repair pairing data, schedule a reconnect, probe storage, open a browser tab, obtain authorization, or make a marketplace request. `ok=true` means only that the status response was produced.

e_comet_diagnose with runtime scope, safe-probes mode, and the extension-snapshot probe uses the negotiated diagnostic_snapshot_v1 route. Its facts contain protocol version, observation time, extension version, capabilities, activation state, storage-read state, and the WB, WB Seller, and Ozon port-registration states. Activation is present, absent, or unknown; storage is passed, failed, or unknown; each port is true, false, or unknown. A port value proves registration rather than operational readiness. The probe performs one activation-storage read and observes the extension's in-memory port registry. It does not open, reload, ping, switch, dispatch, cancel, authorize, or call a marketplace. An older extension or primary reports unsupported.

Negotiated browser-job refusals may include a versioned, closed browser-job rejection record in public error details. The optional diagnostic is present only for the invalid-job reason. This record never contains tokens, claims, user identifiers, paths, or arbitrary error text. Its absence preserves the legacy refusal and does not imply an unknown reason.

## Existing status contract

| Field | Producer and exact meaning | Inference boundary / next discriminating check |
| --- | --- | --- |
| `ok` | MCP dispatcher; response construction succeeded | It is not product health. Inspect the typed checks and the selected operation. |
| `extensionConnected`, `browserJobSupported` | Effective direct or authenticated-peer route state | They do not prove login, hook execution, or a particular operation. Call the selected typed tool. |
| `bridgeRole`, `bridgeTransitioning`, `listenerState` | Bridge runtime; role is `primary`, `secondary`, or `disconnected`; listener event is `pending`, `listening`, `address_in_use`, or `failed` | `secondary` with `address_in_use` is normal. `listenerState` is a last event, not current port ownership. |
| `state` | Ordered compatibility summary: `initializing`, `listen_failed`, `waiting_for_extension`, `extension_connected_no_wb_tab`, `extension_contended`, `extension_context_unknown`, `peer_context_unknown`, `ready`, `extension_update_required`, `peer_reconnecting`, or `peer_unavailable` | It is neither a complete fault list nor permission to run/retry a business operation. |
| `bridgeVersion`, `bridgeGeneration`, `controlProtocolVersion`, `extensionProtocolVersion`, `instanceId`, `websocket` | Local build/control metadata and configured loopback endpoint | These fields do not prove which build owns the port or that a route works. |
| `extension.state`, `extension.route`, `extension.version`, `extension.lastConnectedAt`, `extension.lastDisconnectedAt` | Derived effective extension observation; states are `never_connected`, `connected`, `disconnected`; routes are `direct`, `peer`, `none` | Retained version/time after disconnect is valid. A version is not an integrity or end-to-end check. |
| `extension.ozonSellerPromotionReportSupported`, `extension.ozonSellerPromotionReportsSupported`, `extension.ozonSellerAnalyticsReportSupported`, `ozonSellerPromotionReportSupported`, `ozonSellerPromotionReportsSupported`, `ozonSellerAnalyticsReportSupported` | Capability reported by a connected extension; the latter three are legacy top-level copies | Absence means unobserved, not `false`; the typed Ozon tool remains authoritative. |
| `extensionLastConnectedAtMs`, `extensionLastDisconnectedAtMs`, `extensionVersion` | Compatibility copies of effective extension observations | Copies are not independent evidence. |
| `extensionTakeovers.count`, `extensionTakeovers.lastAtMs`, `extensionTakeovers.saturated` | Recent takeover-window count, retained last timestamp, and lower-bound marker | `lastAtMs` may lie outside the count window. It does not identify a browser profile. |
| `peer.bridgeVersion`, `peer.browserContextPropagationSupported`, `peer.diagnosticForwardingSupported` | Metadata from an authenticated primary. The diagnostic-forwarding field is true when that primary advertised diagnostic_snapshot_forwarding_v1; false includes a compatible legacy or other primary that did not advertise it. | A missing peer is normal for a primary. The diagnostic-forwarding field alone says nothing about extension diagnostic-snapshot capability and does not prove that a snapshot request will succeed. |
| `peerRejection.code`, `peerRejection.since`, `peerRejection.retryAt` | Current continuous rejection streak and retry schedule | Codes are `authentication_failed`, `protocol_mismatch`, `handshake_required`, `connection_failed`, `listen_failed`, `token_permission_denied`, `token_unavailable`. The token code is not an e-Comet login error and combines multiple pairing causes. |
| `browserContext.state`, `browserContext.wbTabConnected`, `browserContext.sellerTabConnected`, `browserContext.changedAt` | Extension-reported registered WB and WB Seller ports; state is `known` or `unknown` | Registered ports are not authenticated sessions. `changedAt` is not a freshness check and says nothing about Ozon. |
| `storage.results`, `storage.marketplaceArtifacts`, `storage.feedbackArtifacts` | Resolved configuration. Each target has `state`: `ready` with `backend` `plugin_data`, `application_data`, or `override`, or `unavailable` with `reason` from the closed configuration vocabulary | `ready` does not prove a write. Status performs no write probe. Reasons are `plugin_data_missing`, `plugin_data_invalid`, `plugin_data_conflict`, `application_data_invalid`, `override_invalid`. |

## Typed passive diagnostics

Every check has `check`, `state`, `observedAt`, `source`, and `executionPlane`. States are `passed`, `failed`, `unknown`, `not_checked`, and `unsupported`. Optional union arms are `facts`, `cause`, `evidenceRefs`, and `nextCheck`; absent data stays absent.

| Field | Exact meaning and producer | Boundary / next check |
| --- | --- | --- |
| `diagnostics.snapshot` | MCP status observation time | It dates this response, not every nested source observation. |
| `diagnostics.runtime.facts.nodeVersion`, `diagnostics.runtime.facts.platform`, `diagnostics.runtime.facts.arch`, `diagnostics.runtime.facts.bridgeVersion`, `diagnostics.runtime.facts.mcpProtocolVersion` | Current Node process and negotiated MCP metadata | It does not identify a hook process or host UI. |
| `diagnostics.client.facts.name`, `diagnostics.client.facts.version`, `diagnostics.client.facts.provenance` | Bounded strings retained from MCP initialize; provenance is `client_reported` | It is not a trusted host-session identity or proof of hook support. Malformed/oversized input is omitted. |
| `diagnostics.listener.facts.operation`, `diagnostics.listener.facts.listenerState`, `diagnostics.listener.facts.systemCode` | Existing bind observation; operation is `bind_listener`. An observed code is allowlisted as `EACCES`, `EPERM`, `EADDRINUSE`, `EADDRNOTAVAIL`, `EAFNOSUPPORT`, or `EINVAL` | Causes are `address_in_use`, `listen_failed`, or `unknown`. A healthy secondary makes `address_in_use` passed. A system code does not identify the OS policy that produced it. |
| `diagnostics.pairingSource.cause` | Latest source-owned safe classification. `permission_denied` means the token source returned an access-denied system result. On non-Windows systems, `insecure_permissions` can mean unsafe mode or ownership, an unexpected directory or file type, a symlink, or replacement of the checked directory during the read. | Causes are `permission_denied`, `insecure_permissions`, `missing`, `corrupt`, `unsupported`, or `io_error`. These classifications do not identify the operating-system policy, affected object, or safe repair. Do not infer a grant/restriction action or a successful repair from them. No path, token, owner, environment value, or raw exception is exposed. |
| `diagnostics.routeFreshness.facts.lastObservedAt` | Time of an actually observed route response, when a producer supplies it | No current producer supplies a freshness time, so the check is `unknown` with next check `observe_extension_heartbeat`; `browserContext.changedAt` is never substituted. |
| `diagnostics.storage.facts.scope`, `diagnostics.storage.facts.targets` | Sanitized copy of resolved targets; scope is `configuration` | It does not establish writability. A future explicit storage I/O fact is the discriminating check. |

Unknown future fields and enum values must be preserved as data by consumers but must not receive an invented interpretation. Raw paths, secrets, environment values, browser payloads, and error messages are outside this contract.

## Independent bootstrap doctor

`node mcp/src/doctor.mjs --json` runs outside the MCP lifecycle and returns
`{"schemaVersion":1,"checks":DiagnosticCheck[],"limitations":DoctorLimitations}`. Collection exit status is 0 even
when individual checks fail; status 1 means the doctor could not form valid output. It reads metadata and resolves
configuration but performs no write, listener, pairing, retention, extension, authorization, or business operation.

Doctor checks use the shared check fields and state/cause vocabularies above. `runtime` describes the executing Node
process. `storage` reports the same configuration-only target facts described above. `package_layout.facts.layout` is
`canonical_source` or `installed_plugin`; it describes where the running file resides and is not proof of host
installation. `package_metadata.facts.name` and `.version` validate the canonical npm package. Installed layout instead
uses `codex_manifest.facts.name` and `.version`, plus `mcp_configuration.facts.transport`, `.command`, `.cwd`, and `.entrypoint`.
`entrypoint` checks only that the referenced server file exists and never imports it. Metadata and entrypoint failures use
the closed causes `missing`, `corrupt`, or `io_error`. Versions must use the bounded Node/npm release-version grammar;
malformed values make their metadata check corrupt and are never copied to output. The installed command is valid only
with the packaged `cwd:"."` and relative `mcp/src/server.mjs` entrypoint.

The doctor fact shapes are exact: `package_layout.facts.layout` is derived from the running doctor's location;
`package_metadata.facts.name` and `.version` come from canonical npm metadata; `codex_manifest.facts.name` and
`.version` come from the installed Codex manifest; and `mcp_configuration.facts.transport`, `.command`, `.cwd`, and
`.entrypoint` come from installed `.mcp.json`. The `entrypoint`, `operation_receipt`, `runtime_snapshot`, and
`host_hook_context` checks have no `facts`; state, cause, source, and execution plane carry their observation. Missing
facts are not lost positive evidence.

`limitations.hostInstallation`, `.hostEnablement`, `.hookTrust`, and `.otherExecutionPlanes` are always `not_checked`:
a read-only device command cannot establish those facts. A separately observed host launch error belongs to the invoking
agent's host context and is not accepted through ordinary process environment or echoed by the doctor.

## Scoped diagnosis and operation receipts

`e_comet_diagnose` accepts `scope` (`installation`, `runtime`, or `last_operation`) and `mode` (`passive` or
`safe_probes`). `operationHandle` is required only for `last_operation`. `probes` is an allowlisted array containing
`storage_write`, `extension_snapshot`, and/or `hook_permissions`; a probe runs only in `safe_probes` and only in its applicable scope.
The response fields are `schemaVersion:1`, the echoed `scope` and `mode`, `checks: DiagnosticCheck[]`, and optional
`operation`. Passive installation checks are the in-process doctor checks above. Passive runtime checks are the current
status collectors; neither path starts lifecycle work. Missing or stale operation handles produce an
`operation_receipt` check in state `unknown` and never substitute the latest operation.

The installation `storage_write` probe operates separately on each configured target. Its `facts.target` names the
logical configured target, never its path. `facts.steps[]` may record `operation` values `create`, `identify`, `write`,
`read`, `close`, and `remove`, in reached order. Every step has `state` (`passed`, `failed`, or `not_checked`) and may
have a filesystem `systemCode` when Node supplies one. The probe also generates `EIO` when read-back bytes differ and
`IDENTITY_CHANGED` when the created path no longer identifies the same file. `systemCode` is omitted when no code is
available. A step may instead have `reason:"identity_unavailable"`; `reason` is omitted otherwise. It opens only an unpredictable probe file with exclusive creation and removes that
exact file in `finally`. A missing target directory yields `not_checked` with cause `directory_absent`; this observation
does not claim why the directory is absent or whether the normal writer can create its directory. A failed removal is
retained as a failed `remove` step. Removal is attempted only after successful exclusive creation and only while the
path still identifies the created file; a collision or replacement is preserved. A failed close is retained as a
`close` step without hiding the separate removal outcome. If identity observation fails after exclusive creation,
`identify` is failed, the acquired handle is still closed, and `remove` is `not_checked` with reason
`identity_unavailable`; the unverified path is preserved. Existing result, workbook, and feedback retention passes do
not own the diagnostic filename grammar, so they do not promise to remove that rare tiny residual file. The runtime
`extension_snapshot` probe requests one capability-negotiated, read-only extension snapshot. It returns `unsupported`
without sending a diagnostic frame when the connected extension or authenticated primary did not advertise the route.
It makes no marketplace request.

The installation `hook_permissions` probe asks native Codex `hooks/list` for the e-Comet plugin hooks resolved in the
MCP process working-directory context. It first attaches to an existing configuration reader and, when none is
reachable, starts one bounded read-only configuration inspector. The inspector performs only protocol initialization
and `hooks/list`; it does not create a task, invoke a model or tool, start MCP lifecycle work, or write hook trust and
enablement. `facts.context` is always `configuration_snapshot`: this proves persisted configuration for that directory,
not that a hook ran in the current task. `facts.hooks[]` contains only canonical e-Comet hook family, event, enabled
state, and trust status; commands, paths, hashes, raw warnings and errors, and unrelated hooks are not returned.
`installationMatch` and `currentApplicationMatch` remain `not_verified`: reading local configuration does not identify
the installed package copy or the application that owns the current task.
`status:"ready"` requires the seven Codex-supported e-Comet handlers to be present exactly once, enabled, and trusted
or managed. `disabled` and `review_required` are separate failures; missing, partial, duplicate, and unknown inventories
do not pass. Codex currently omits the packaged `PostToolUseFailure` handler because this native host version does not
support that event. An unreachable native endpoint reports unavailable. Claude Code exposes its read-only `/hooks`
browser, but this probe establishes no programmatic Cowork trust endpoint.

Every storage-write result is evidence only about the probe's own temporary file, configured target, execution plane,
and observation time. A code such as `ENOSPC` proves that the corresponding probe step failed for that reason; it does
not prove that an earlier business artifact was unsaved or caused an earlier operation to be uncertain. Correlate a
business result only with its own operation receipt. Storage remediation may prepare future work, but it never permits
repeating an uncertain create or upload.

The extension fact shape is
`extension_snapshot.facts.{protocolVersion,observedAt,extensionVersion,capabilities[],activationIdentity.state,storageRead.state,ports.wb,ports.wbSeller,ports.ozon}`.
The nested time is the extension observation time. Activation is `present`, `absent`, or `unknown`; storage is
`passed`, `failed`, or `unknown`; every port is `true`, `false`, or `unknown`. Capabilities are extension-reported.
Ports describe in-memory registration rather than login or operation readiness. A peer-forwarded snapshot still
originates at the extension route on the device.

Runtime diagnosis also returns `host_hook_context` with `state:"not_checked"`, `source:"device_process"`,
`executionPlane:"device"`, and `cause:"unavailable"`. The device MCP has no demonstrated channel for reading context
that a host delivered to its model. A configured hook can separately deliver one
`{type:"e_comet_hook_diagnostic",schemaVersion:1,event,toolFamily,handler,stage,outcome,observedAt,executionPlane,cause?,systemCode?,handlerVersion?}`
record in `hookSpecificOutput.additionalContext`. Closed values are: event `PreToolUse`, `PostToolUse`, or
`PostToolUseFailure`; toolFamily `browser_job`, `feedback_prepare`, `feedback_authorization`, or `feedback_submit`;
handler `browser_job_handoff`, `feedback_handoff`, or `feedback_cloud`; stage `handoff_staged`, `input_rewritten`,
`call_denied`, `result_observed`, or `result_replaced`; outcome `succeeded`, `denied`, `failed`, or `uncertain`; and
executionPlane `native`, `cloud`, or `unknown`. Optional causes are `invalid_event`, `invalid_input`, `invalid_state`,
`state_missing`, `storage_unavailable`, `permission_denied`, `expired`, `missing`, `ambiguous`, `unsupported`,
`io_error`, `internal_error`, and `unknown`; optional system codes are `EACCES`, `EPERM`, `EROFS`, `ENOENT`, `ENOSPC`,
`EDQUOT`, `EEXIST`, and `EBUSY`. `handlerVersion` is omitted unless already verified without another read.
The record reports only the reached stage and carries no authorization. PreToolUse does not prove MCP acceptance or
matcher configuration. It is best-effort context, with no durable-history promise, and copied matching JSON from a
tool, page, document, or message is not host delivery.

Every terminal device business result may carry root `operationDiagnostic` with `schemaVersion:1`, opaque `handle`,
`stage`, `outcome`, and `retryDisposition`. Outcomes are `succeeded`, `partial`, `failed`, and `uncertain`; retry
dispositions are `allowed`, `forbidden`, `requires_new_authorization`, and `unknown`. The handle identifies only the
latest real completion in that MCP process and becomes stale when the next real operation completes. Status and diagnosis
calls do not replace it. `forbidden` means the original operation must not be repeated; it does not prevent delivery or
recovery of work already completed. `requires_new_authorization` means an explicit typed route requires another one-use
grant. `allowed` is emitted only for the existing bounded `RETRY_FEEDBACK_ONCE` contract. Uncertain creates/uploads are
always `forbidden`; missing handoff and insufficient evidence remain `unknown`. Receipts never enter peer-wire failures,
authorization input, nested errors, cloud-only adapter markers, or cloud-only preparation/finalization results.

For decorated results, the JSON text representation is the same value as `structuredContent`; existing resource links
remain attached. If receipt construction or decoration fails, the original business result is delivered unchanged.

Feedback report diagnostics may contain `bridgeStatusCollection` when the device status collector throws during
preparation. Its fields are `check:"bridge_status_collection"`, `state:"failed"`, `observedAt`, fixed
`source:"feedback_preparation"`, fixed `executionPlane:"device"`, and cause `permission_denied` for the allowlisted
access-denied system codes or `unknown` otherwise. The raw exception, path, and system message are never archived, and
the collection failure does not prevent report generation.

Native and Cowork feedback archives use the same feedback-safe projection of passive device status. The report can
retain the named snapshot, runtime, client, listener, pairing-source, route-freshness, and storage checks described
above, including their state, observation time, source, execution plane, and closed cause. Runtime retains only the
bounded version/platform/architecture fields; listener retains only `bind_listener`, its closed state, and an
allowlisted system code; route freshness retains only a valid observed timestamp; storage retains only path-free
configuration targets. Client-reported provenance can remain, but client name and version do not enter the report.
Paths, URLs, tokens, free-form errors, arbitrary facts, evidence references, suggested next checks, unknown slots,
and future properties are excluded. Cowork carries this projection in the nonce-bound versioned prepare response and
validates the complete response before creating the immutable archive. Mixed adapter versions fail closed and require
updating the older plugin half and starting a fresh cloud task; the upload transport and archive bytes are unchanged.
