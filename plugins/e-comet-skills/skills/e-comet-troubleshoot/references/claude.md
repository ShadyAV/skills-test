# Claude host actions

Use these actions only after the corresponding Claude surface is observed.

- Claude Code CLI: inspect the exact candidate with `claude plugin validate ... --json` and `claude --plugin-dir ... plugin list --json`. After hook or MCP configuration changes, use `/reload-plugins` or restart. For an observed hook failure, a bounded isolated `--debug-file` can distinguish hook events.
- Claude Desktop Code: verify install and enablement in that Code surface, restart the app after an update, and open a fresh task. CLI identity or loader success does not prove Desktop behavior.
- Cowork local: verify the plugin is installed and enabled in Cowork and that device policy permits local MCP only when absence is observed. A visible permission request needs the user's answer; it is not an installation failure.
- Cowork cloud: local MCP runs on the bound device, not in the cloud sandbox. Check account plugin sync separately from device availability. Cloud hook context and device MCP facts are separate evidence planes.

Current official documentation verifies Cowork → Customize → Plugins for installation and Claude Code's commands above. Exact update-card labels remain a UI acceptance gap. If the exact installed build has not been exercised on the observed Claude surface, state that verification gap. Accepted local observations establish split cloud/device execution and hook dispatch for earlier builds only.

The `hook_permissions` safe probe reads local Codex configuration. Do not use its result as Claude Code or Cowork hook evidence; use the host-specific checks above.

Official sources, verified 2026-09-13: [Claude hooks](https://code.claude.com/docs/en/hooks), [plugin loading and CLI inspection](https://code.claude.com/docs/en/plugins-reference), [Cowork plugin installation](https://support.claude.com/en/articles/13837440-use-plugins-in-claude), and [Cowork local/cloud architecture](https://support.claude.com/en/articles/14479288-claude-cowork-architecture-overview).
