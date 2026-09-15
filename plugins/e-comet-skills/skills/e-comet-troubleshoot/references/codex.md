# Codex host actions

Use these actions only after the corresponding Codex surface is observed.

- Codex CLI: `codex --version` identifies the CLI only. When the host reports an untrusted or skipped e-Comet hook, use `/hooks`, review the named definition and trust it only if the user recognizes its source. Start a fresh CLI session after plugin component updates unless reload was separately observed.
- ChatGPT Desktop with Codex: verify the plugin is present and enabled for the actual trusted project, restart Desktop after local marketplace or plugin file changes, and open a fresh task. Installation does not itself establish trust for bundled hooks.
- Keep CLI and Desktop conclusions separate: their bundled Codex versions can differ. No current verified Windows UI path or command in the accepted evidence identifies the Desktop-bundled version.

When hook permission is unclear, call `e_comet_diagnose` with installation scope, `safe_probes`, and `hook_permissions`. Treat its result as a saved configuration snapshot for the checked directory. `ready` means every expected native e-Comet handler is enabled and trusted; `disabled` and `review_required` identify different fixes in `/hooks`. The result does not prove which Codex app owns an existing reader or that any handler ran in this task.

An already exposed tool proves availability only in the current task. Parser or loader success alone is not hook execution evidence. If the exact installed build has not been exercised on the observed Codex surface, state that verification gap.

Official sources, verified 2026-09-13: [hooks and trust](https://learn.chatgpt.com/docs/hooks), [CLI and Desktop troubleshooting](https://learn.chatgpt.com/docs/reference/troubleshooting), and [plugin packaging and refresh](https://developers.openai.com/plugins/build/plugins). Accepted local observation confirms that Codex CLI can discover e-Comet hook definitions as untrusted; discovery alone did not prove a trusted lifecycle.
