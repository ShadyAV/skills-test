---
name: e-comet-troubleshoot
description: Use when e-Comet installation, local MCP startup, browser extension routing, storage, report creation, upload, or host hook behavior fails or remains uncertain, and when the user says e-Comet tools are missing, not answering, asking to sign in, or "worked before".
---

# Troubleshoot e-Comet

Base every conclusion on an observed typed result. Absence of a local tool can be a valid remote-only installation and does not prove a broken full installation.

## Triage before any conclusion

Both hosts load tools on demand. Search the host tool catalog for `e-comet` with a large result limit, or search by
exact tool name. A fresh task's start list proves nothing. A truncated search result does not prove absence; use the
host's supported bounded search again or search for the exact capability before calling it unavailable.

| Observed after search | Meaning | Next step |
| --- | --- | --- |
| No e-Comet tools | Installation or enablement is uncertain; in Cowork the remote connector may also be disconnected | Cowork: call host `ListConnectors` filtered for e-Comet. Codex: use the [README fallback](https://github.com/e-comet/skills#troubleshooting) to check marketplace, plugin installation and enablement, then start a new task. No local probe is available. |
| Local tools present, remote tools absent | Remote authorization, chat enablement, or connection is uncertain | Codex: call installation `e_comet_diagnose` with `safe_probes` and `codex_mcp_auth`. Cowork: call `ListConnectors`. Apply the connector rules below. |
| Remote tools only | This can be a basic installation or a full installation whose local MCP did not start | Ask which installation was intended; for a full installation use the README fallback. |
| Both present | Tools are visible in this task | Continue with the numbered steps below. |

The extension connects through the local MCP. When the local MCP is absent, first resolve that host route; extension
checks cannot explain the missing local tools.

## Remote connector rules

Give the connector action in the first answer where its evidence appears. A firm authorization conclusion requires
a remote call's host authorization error or a
host system notice naming authorization. Say e-Comet is not authorized and ask the user to connect the remote
connector; until then analytics, live data and reports are unavailable. Cowork `ListConnectors.installState` other
than `connected` supports the distinct conclusion that its connector is not connected, with the Connect action.
Codex `facts.status:"not_logged_in"` supports the qualified wording "According to the
Codex configuration, e-Comet sign-in was not completed" with the same action. `credentials_present` proves only
stored credentials: call `info` if available, and let its host authorization error outrank the snapshot. `missing`,
`ambiguous`, `unknown_status`, and `not_checked` support no authorization claim. Without stronger
evidence, say only that remote tools are not visible and check whether the connector is connected and authorized.

In Cowork `installState:"connected"` with `enabledInChat:false` means connected but disabled for this chat. Ask the
user to enable it for the chat, not to sign in. Cowork's Connect action is on the plugin card under Connectors (or
the Connect button on the connectors card). Codex in ChatGPT Desktop: Settings → Plugins → e-Comet MCP Tools →
server E-comet → Connect. Do not give a CLI command as the user's Desktop action. Before concluding that the
remote server is down or answering about a particular organization, call `info` when available: inspect subscription
tier and expiry, and that organization's `read` flag. An expired subscription or absent readable organization is a
specific observation, not a server-down diagnosis. A stored-credentials snapshot or a host `connected` status
before a real call does not establish that the call will succeed.

Only when remote tools fail with an observed network error while local tools work, suggest checking the host's
network permission as a candidate: `Allow network egress` in Cowork, `Allow network access` in Codex. Neither
permission is a diagnosed cause from tool absence alone.

For feedback sending or feedback-specific recovery, call `describe_e_comet_tool({name:"prepare_e_comet_feedback"})` once and follow the returned contract before feedback preparation.

1. For a host launch or bootstrap failure, use the independent [public fallback](https://github.com/e-comet/skills#troubleshooting). If Node can run the packaged file, collect exactly one `node mcp/src/doctor.mjs --json` result. Doctor covers only that Node execution plane.
2. For current local runtime facts, the agent calls `local_bridge_status`. `ok:true` means the response was produced, not that the product is healthy. A secondary with `address_in_use` can be healthy.
3. The agent calls `e_comet_diagnose` with the narrowest scope for installation evidence, runtime extension context, or an exact operation receipt. Installation probes are `storage_write`, `extension_install`, and, only for an observed Codex host, `hook_permissions` and `codex_mcp_auth`; the runtime probe is `extension_snapshot`. All require `safe_probes`. Pairing has no probe: runtime diagnosis can only return the existing `pairingSource` observation. Repeating a passive read does not guarantee a more specific cause.
4. Read [DIAGNOSTICS.md](../../mcp/DIAGNOSTICS.md) for exact field and enum meanings. After the host is observed, read only [Codex](references/codex.md) or [Claude](references/claude.md).

## Extension rules

With a working local MCP and `extensionConnected:false`, run installation `extension_install` (`safe_probes`)
first, and read DIAGNOSTICS.md for its coverage and inference boundaries. When metadata reads are complete,
`installedProfiles:0` in all checked browsers supports absence only in those checked profiles. Ask which browser
the user uses; if it is one of the checked browsers, installing from its extension store is a candidate action.
Installed with `enabledProfiles:0` and `unknownProfiles:0` supports enabling it in the named browser only when
metadata reads are complete. `enabledProfiles>0` names a candidate browser: for a Wildberries page flow, suggest
starting that browser and opening any wildberries.ru page; the extension connects by itself. If
`profileSource:"default_only"`, explain that only its Default profile was checked. If any `unknownProfiles>0`,
read failure, `unknown`, or `not_checked` remains, do not call the extension disabled or absent everywhere. Ask
which browser holds it and whether it is enabled, then suggest opening a wildberries.ru page there for a
Wildberries page flow. Other browsers, including Firefox, are not covered by the probe; Firefox is unsupported
and a Chromium browser is required. These actions are candidates, not a proven disconnected-route cause. Never
prescribe a WB tab for an Ozon operation; use its typed Ozon route result instead.
For an Ozon route, if a found copy's `versions[]` is below the typed Ozon minimum, suggest updating it to that
minimum only as a preliminary clue. The version from a connected extension's `hello_ack` is authoritative; the
found copy does not prove which browser is connected.

When the extension is connected and a signed tool fails at the `authorization` stage, or the user asks to check
installation or activation, run runtime `extension_snapshot` first. `activationIdentity.state:"absent"` supports
activating the extension with the API key from the e-Comet account in that browser. For other typed refusals use the
`browserJobRejection.reason` table in DIAGNOSTICS.md. `errorDetails.code:"WB_NOT_AUTHENTICATED"` on a buyer product
unit supports signing in to wildberries.ru in the browser and profile that made the request; the snapshot is only
a hint about which browser that was.

Answer in this order: the plain-language problem; the proven cause or explicit uncertainty; the smallest action supported by that evidence; the observable result to expect. A request for troubleshooting, support, or help is not by itself a request for technical details. Perform available diagnostic calls yourself. Give the user only the action that requires their host or permission. Unknown may remain unknown with no next action or promised result. Keep JSON, codes, paths, protocol, JWT, listener, configuration, peer, and hook details unless the user explicitly asks to see a particular technical detail.

Keep observations within their component, operation, and observation time. A storage-write probe tests only its own temporary file at that time. Even a concrete failure such as no free space does not prove that an earlier business report was unsaved or explain an uncertain report outcome. It can support preparing storage for future work, but an uncertain create or upload still follows its own receipt and must not be repeated. Likewise, describe a failed listener observation as a listener failure rather than broadening it to the whole local connection, and do not infer the current port owner from a past address-in-use event.

Respect typed business results. WB, WB Seller, and Ozon have separate prerequisites. Status observations do not prove that the connection or extension is “working” for Ozon. Use the typed Ozon route result for recovery: when it reports an unready route without an update detail, the supported action is to check the extension in the same browser profile, refresh any authenticated Ozon Seller page under `/app`, and obtain new authorization before a user-chosen retry. Do not invent a company selector, a specific page, or a guarantee that another attempt will expose a more specific error. Never prescribe a WB tab for Ozon. Configuration `ready` does not prove writable storage; when the safe storage probe is the supported discriminator, the agent runs it rather than asking the user to invoke an MCP diagnostic. `unsupported`, `unknown`, and `not_checked` are different. A pairing permission aggregate needs its concrete diagnostic subreason before explanation, but neither `permission_denied` nor `insecure_permissions` identifies a safe repair. For example: “The app was denied access” and “The stored connection data did not pass its safety check” describe different observations, but neither identifies a repair. Do not tell the user to grant or restrict permissions, or promise that such a change will repair pairing, from either classification alone. Missing native hook context is unavailable evidence; missing Cowork cloud context is not device evidence.

A successful Codex `hook_permissions` result is a configuration snapshot for the checked installation context, not proof that a hook ran in this task. `ready` means all expected native handlers are enabled and trusted. `disabled` means at least one trusted handler is off. `review_required` means at least one handler is new or changed and awaits review. Name the affected safe handler roles. A `not_checked` result with `facts.context:"configuration_probe"` means the bounded inspector failed before a hook inventory was available; use its closed `failure.reason` and `failure.phase` as probe evidence, and do not describe hooks as missing, disabled, or untrusted. For observed ChatGPT Desktop with Codex, direct the user to Settings → Plugins → Personal → e-Comet MCP Tools → Hooks only when a snapshot observed a disabled or review-required handler: enable a disabled handler, or review a new or changed handler and trust it only if the user recognizes its source. For observed Codex CLI, use `/hooks` for the corresponding observed action and apply the same trust condition. Do not expose paths, commands, hashes, or raw inspector errors. Do not use a local Codex snapshot to explain Claude Code or Cowork.

Never repeat an uncertain create. Do not invent an Ozon report list, history, status, receipt API, or UI to resolve an unknown create; the outcome may remain unknown. A later create for the same item is a separate informed user decision under the current typed product contract, never a retry justified by missing output. Recovery applies only to work already proven complete through a supported operation.

Plain examples:

- Pairing cause unknown: “The local connection could not be checked closely enough to name the cause. There is nothing useful you need to do yet.”
- Create outcome unknown: “It is unclear whether that report was created. I will not repeat it. There is no supported status check that can resolve this.”
- Host step unavailable: “I cannot verify from here whether that app step ran. This does not show that the integration is broken.”

Common mistakes: prescribing reinstall, login, opening WB, protection changes, or hook trust from absence alone; treating a stale version as the cause without a typed version failure; treating a registered tab as operational readiness; treating doctor output as host installation or enablement proof.

A missing exact packaged entrypoint is evidence that the package contents or configuration are incomplete and supports restoring package integrity through the host's supported installation path. Generic tool absence alone does not support reinstalling. A failed update lookup proves only that update availability is unknown; it does not create a useful user-run recheck step.
