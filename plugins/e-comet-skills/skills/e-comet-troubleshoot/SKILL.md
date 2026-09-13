---
name: e-comet-troubleshoot
description: Use when e-Comet installation, local MCP startup, browser extension routing, storage, report creation, upload, or host hook behavior fails or remains uncertain.
---

# Troubleshoot e-Comet

Base every conclusion on an observed typed result. Absence of a local tool can be a valid remote-only installation and does not prove a broken full installation.

1. For a host launch or bootstrap failure, use the independent [public fallback](https://github.com/e-comet/skills#troubleshooting). If Node can run the packaged file, collect exactly one `node mcp/src/doctor.mjs --json` result. Doctor covers only that Node execution plane.
2. For current local runtime facts, the agent calls `local_bridge_status`. `ok:true` means the response was produced, not that the product is healthy. A secondary with `address_in_use` can be healthy.
3. The agent calls `e_comet_diagnose` with the narrowest scope for installation evidence, runtime extension context, or an exact operation receipt. The only probes are `storage_write` for installation and `extension_snapshot` for runtime; both require `safe_probes`. Pairing has no probe: runtime diagnosis can only return the existing `pairingSource` observation. Repeating a passive read does not guarantee a more specific cause.
4. Read [DIAGNOSTICS.md](../../mcp/DIAGNOSTICS.md) for exact field and enum meanings. After the host is observed, read only [Codex](references/codex.md) or [Claude](references/claude.md).

Answer in this order: the plain-language problem; the proven cause or explicit uncertainty; the smallest action supported by that evidence; the observable result to expect. A request for troubleshooting, support, or help is not by itself a request for technical details. Perform available diagnostic calls yourself. Give the user only the action that requires their host or permission. Unknown may remain unknown with no next action or promised result. Keep JSON, codes, paths, protocol, JWT, listener, configuration, peer, and hook details unless the user explicitly asks to see a particular technical detail.

Keep observations within their component, operation, and observation time. A storage-write probe tests only its own temporary file at that time. Even a concrete failure such as no free space does not prove that an earlier business report was unsaved or explain an uncertain report outcome. It can support preparing storage for future work, but an uncertain create or upload still follows its own receipt and must not be repeated. Likewise, describe a failed listener observation as a listener failure rather than broadening it to the whole local connection, and do not infer the current port owner from a past address-in-use event.

Respect typed business results. WB, WB Seller, and Ozon have separate prerequisites. Status observations do not prove that the connection or extension is “working” for Ozon. Use the typed Ozon route result for recovery: when it reports an unready route without an update detail, the supported action is to check the extension in the same browser profile, refresh any authenticated Ozon Seller page under `/app`, and obtain new authorization before a user-chosen retry. Do not invent a company selector, a specific page, or a guarantee that another attempt will expose a more specific error. Never prescribe a WB tab for Ozon. Configuration `ready` does not prove writable storage; when the safe storage probe is the supported discriminator, the agent runs it rather than asking the user to invoke an MCP diagnostic. `unsupported`, `unknown`, and `not_checked` are different. A pairing permission aggregate needs its concrete diagnostic subreason before explanation, but neither `permission_denied` nor `insecure_permissions` identifies a safe repair. For example: “The app was denied access” and “The stored connection data did not pass its safety check” describe different observations, but neither identifies a repair. Do not tell the user to grant or restrict permissions, or promise that such a change will repair pairing, from either classification alone. Missing native hook context is unavailable evidence; missing Cowork cloud context is not device evidence.

Never interrupt an authorized feedback chain with diagnostics. Never repeat an uncertain create or upload. Do not invent an Ozon report list, history, status, receipt API, or UI to resolve an unknown create; the outcome may remain unknown. A later create for the same item is a separate informed user decision under the current typed product contract, never a retry justified by missing output. For uncertain feedback upload, preparation metadata such as expiry does not prove downloadable or recoverable bytes. Do not promise an archive, save or receipt lookup, resend that artifact, or propose a new report as a workaround. Recovery applies only to work already proven complete through a supported operation.

Plain examples:

- Pairing cause unknown: “The local connection could not be checked closely enough to name the cause. There is nothing useful you need to do yet.”
- Create outcome unknown: “It is unclear whether that report was created. I will not repeat it. There is no supported status check that can resolve this.”
- Feedback upload uncertain: “It is unclear whether the report was received. I will not send that report again or create another one to work around this.”
- Host step unavailable: “I cannot verify from here whether that app step ran. This does not show that the integration is broken.”

Common mistakes: prescribing reinstall, login, opening WB, protection changes, or hook trust from absence alone; treating a stale version as the cause without a typed version failure; treating a registered tab as operational readiness; treating doctor output as host installation or enablement proof.

A missing exact packaged entrypoint is evidence that the package contents or configuration are incomplete and supports restoring package integrity through the host's supported installation path. Generic tool absence alone does not support reinstalling. A failed update lookup proves only that update availability is unknown; it does not create a useful user-run recheck step.
