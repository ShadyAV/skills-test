// One linear pass over an untrusted transcript name: `_` belongs to the class, so `__`-joined host
// prefixes still match without an alternation whose overlapping paths backtrack exponentially. Real
// names are short identifiers — the longest observed are Cowork's URL-slug MCP names such as
// `mcp__https_mcp_e-comet_io_mcp__report_issue` (43) — so this cap keeps threefold headroom while
// stopping one absurd transcript value from spending the report's share of the archive budget.
const TOOL_NAME_MAX_LENGTH = 256;
const TOOL_NAME = /^[A-Za-z][A-Za-z0-9._:-]*$/;
const FEEDBACK_TOOL_SUFFIXES = new Set([
    'prepare_e_comet_feedback',
    'report_issue',
    'submit_e_comet_feedback',
]);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const isFeedbackTool = (name) => {
    const suffix = name.split('__').at(-1);
    return FEEDBACK_TOOL_SUFFIXES.has(suffix);
};

export const isFeedbackToolName = (value) =>
    typeof value === 'string' && value.length <= TOOL_NAME_MAX_LENGTH && TOOL_NAME.test(value);

const acceptedToolName = (value) => isFeedbackToolName(value) && !isFeedbackTool(value);

const claudeToolCalls = (record) => {
    if (record.type !== 'assistant' || !isObject(record.message) || !Array.isArray(record.message.content)) return [];
    return record.message.content
        .filter((content) => isObject(content) && content.type === 'tool_use' && acceptedToolName(content.name))
        .map(({ name }) => name);
};

const codexToolCall = (record) => {
    const item = record.type === 'response_item'
        ? record.payload
        : record.type === 'item.completed'
          ? record.item
          : record.type === 'event_msg' && isObject(record.payload) && record.payload.type === 'item.completed'
            ? record.payload.item
          : undefined;
    return isObject(item) && (item.type === 'function_call' || item.type === 'custom_tool_call') && acceptedToolName(item.name)
        ? item.name
        : undefined;
};

/**
 * Extract only the tool names in documented Claude and Codex JSONL records. Payloads are never
 * searched recursively because transcript content is untrusted diagnostic input.
 *
 * @param {Buffer} jsonlBytes
 * @returns {string[]}
 */
export const extractFeedbackToolCalls = (jsonlBytes) => {
    if (!Buffer.isBuffer(jsonlBytes)) return [];
    const names = [];
    for (const line of jsonlBytes.toString('utf8').split('\n')) {
        let record;
        try {
            record = JSON.parse(line);
        } catch {
            continue;
        }
        if (!isObject(record)) continue;
        names.push(...claudeToolCalls(record));
        const codexName = codexToolCall(record);
        if (codexName !== undefined) names.push(codexName);
    }
    return names;
};
