import { NodeApiError, sleep } from 'n8n-workflow';

/**
 * Retry budget for polling. n8n's own "Retry on Fail" node setting is ignored for
 * polling triggers — `PollTriggerExecutor` emits the error straight to the error
 * workflow — so the trigger has to absorb transient failures itself. The numbers
 * mirror n8n's defaults: 3 attempts in total (the initial call plus 2 retries),
 * 5 seconds apart.
 */
export const MAX_TRIES = 3;
export const WAIT_BETWEEN_TRIES_MS = 5000;

/**
 * Network-level failures: the request never got an answer from Slack, so the
 * same call may well succeed a moment later.
 */
const TRANSIENT_NETWORK_CODES = new Set([
	'EAI_AGAIN',
	'ECONNABORTED',
	'ECONNREFUSED',
	'ECONNRESET',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'ENOTFOUND',
	'EPIPE',
	'ETIMEDOUT',
	'GETADDRINFO',
]);

/** HTTP statuses that mean "busy, come back later" rather than "bad request". */
const TRANSIENT_HTTP_CODES = new Set(['408', '429', '500', '502', '503', '504']);

function isTransientCode(code: unknown): boolean {
	if (typeof code !== 'string' && typeof code !== 'number') return false;
	const value = String(code).toUpperCase();
	return TRANSIENT_NETWORK_CODES.has(value) || TRANSIENT_HTTP_CODES.has(value);
}

/**
 * Decides whether a failure is worth another attempt.
 *
 * Slack's own `ok: false` errors (`invalid_auth`, `list_not_found`, `missing_scope`, …)
 * are deterministic and deliberately excluded — retrying them only delays a report
 * the user needs to see. Those responses carry no HTTP/network status code, so they
 * fall through to `false`.
 */
export function isTransientError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;

	const candidates = [
		error instanceof NodeApiError ? error.httpCode : undefined,
		(error as { code?: unknown }).code,
		(error.cause as { code?: unknown } | undefined)?.code,
	];

	return candidates.some(isTransientCode);
}

/**
 * Runs `fn`, retrying it on transient failures up to {@link MAX_TRIES} attempts with
 * {@link WAIT_BETWEEN_TRIES_MS} between them. Non-transient errors, and the last
 * attempt's error, are rethrown untouched.
 */
export async function retryOnTransientError<T>(fn: () => Promise<T>): Promise<T> {
	for (let attempt = 1; ; attempt++) {
		try {
			return await fn();
		} catch (error) {
			if (attempt >= MAX_TRIES || !isTransientError(error)) {
				// Already a NodeApiError from `slackApiRequest`; rethrown as-is so the
				// caller sees the original Slack/network diagnosis.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				throw error;
			}
			await sleep(WAIT_BETWEEN_TRIES_MS);
		}
	}
}
