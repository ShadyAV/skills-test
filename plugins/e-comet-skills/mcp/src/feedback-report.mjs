import { FEEDBACK_KINDS } from './config.mjs';
import { FeedbackPreparationError } from './feedback-errors.mjs';
import { selectFeedbackDeviceSnapshot } from './feedback-device-diagnostics.mjs';
import { isFeedbackToolName } from './feedback-tool-calls.mjs';

const FEEDBACK_KIND_SET = new Set(FEEDBACK_KINDS);
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/**
 * The canonical line-ending fold every feedback report goes through before redaction. The trusted
 * hooks import it so a projection they measure cannot drift from the text the archive will hold:
 * measuring lone-CR text unfolded collapses a whole report into one header line.
 */
export const foldFeedbackLineEndings = (value) => value.replace(/\r\n?/g, '\n');

const normalizeText = (value) => {
    if (typeof value !== 'string') throw new FeedbackPreparationError('FEEDBACK_INPUT_INVALID');
    const normalized = foldFeedbackLineEndings(value);
    if (CONTROL_CHARACTERS.test(normalized)) throw new FeedbackPreparationError('FEEDBACK_INPUT_INVALID');
    return normalized;
};

const redactCookieValues = (value) =>
    value.replace(/\b(set-cookie|cookie)\s*:\s*([^\n]*)/gi, (_match, header, cookieText) => {
        const redacted = cookieText
            .split(';')
            .map((segment) => {
                const delimiter = segment.indexOf('=');
                return delimiter === -1 ? '[REDACTED]' : `${segment.slice(0, delimiter).trim()}=[REDACTED]`;
            })
            .join('; ');
        return `${header}: ${redacted}`;
    });

const redactJsonCredentialValues = (value) =>
    value.replace(
        /("(?:authorization|proxy-authorization|(?:x-)?api[_-]?key|cookie|set-cookie)"\s*:\s*)"(?:\\.|[^"\\])*"/gi,
        '$1"[REDACTED]"',
    );

const redactAuthorizationHeaders = (value) =>
    value.replace(/\b(proxy-authorization|authorization)\s*:\s*([^\n]*)/gi, (_match, header, headerValue) =>
        /^bearer\s+/i.test(headerValue) ? `${header}: Bearer [REDACTED]` : `${header}: [REDACTED]`,
    );

export const redactFeedbackText = (value) => {
    if (typeof value !== 'string') throw new TypeError('Feedback text must be a string');
    return redactAuthorizationHeaders(redactCookieValues(redactJsonCredentialValues(value)))
        .replace(/\bbearer\s+[^\s;,]+/gi, 'Bearer [REDACTED]')
        // The already-redacted alternative comes first so a second pass cannot match ]-terminated
        // placeholder text as a fresh secret and append another bracket. This protects API-key
        // placeholders; wire fitting measures the next redaction pass without assuming global idempotence.
        .replace(/\b(?:x-)?api[_-]?key\s*([:=])\s*(?:\[REDACTED\]|[^\s;,&}\]]+)/gi, (_match, delimiter) => `api_key${delimiter}[REDACTED]`)
        .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
};

export const selectFeedbackDiagnostics = selectFeedbackDeviceSnapshot;

const normalizeToolCalls = (toolCalls) => {
    if (toolCalls === undefined) return [];
    if (!Array.isArray(toolCalls) || toolCalls.some((name) => !isFeedbackToolName(name))) {
        throw new FeedbackPreparationError('FEEDBACK_INPUT_INVALID');
    }
    return toolCalls.map((name) => redactFeedbackText(normalizeText(name)));
};

/** @param {{ kind?: string, summary?: string, details?: string, diagnostics?: unknown, includeTranscript?: boolean, toolCalls?: string[], toolCallsTruncated?: boolean }} input */
export const renderFeedbackReport = ({ kind, summary, details, diagnostics, includeTranscript, toolCalls, toolCallsTruncated } = {}) => {
    // WHY: report validation owns this safe category before transcript or artifact I/O can begin.
    if (!FEEDBACK_KIND_SET.has(kind)) throw new FeedbackPreparationError('FEEDBACK_INPUT_INVALID');
    if (typeof includeTranscript !== 'boolean') throw new FeedbackPreparationError('FEEDBACK_INPUT_INVALID');
    const normalizedSummary = redactFeedbackText(normalizeText(summary));
    const normalizedDetails = redactFeedbackText(normalizeText(details));
    const selectedDiagnostics = selectFeedbackDiagnostics(diagnostics);
    const normalizedToolCalls = normalizeToolCalls(toolCalls);
    const report = [
        '<!-- e-comet-feedback:v1 -->',
        '# e-Comet issue report',
        '',
        '## Kind',
        kind,
        '',
        '## Summary',
        normalizedSummary,
        '',
        '## Details',
        normalizedDetails,
        '',
        '## Current diagnostics',
        '```json',
        JSON.stringify(selectedDiagnostics),
        '```',
        '',
        '## Tool calls',
        // Preparation reads a session bounded by the feedback package budget, so an oversized
        // session leaves only its newest records. Say so rather than implying a complete list.
        ...(toolCallsTruncated === true ? ['Only the newest part of the session was read; earlier tool calls are not listed.'] : []),
        ...(normalizedToolCalls.length === 0
            ? ['No tool calls were available.']
            : normalizedToolCalls.map((name, index) => `${index + 1}. ${name}`)),
        '',
        '## Privacy',
        `Transcript: ${includeTranscript ? 'included' : 'not included'}`,
        '',
    ].join('\n');
    return Buffer.from(report, 'utf8');
};
