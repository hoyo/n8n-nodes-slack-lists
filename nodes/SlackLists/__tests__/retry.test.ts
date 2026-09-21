import { NodeApiError } from 'n8n-workflow';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTransientError, MAX_TRIES, retryOnTransientError } from '../shared/retry';

const node = {
	id: '1',
	name: 'Slack Lists Trigger',
	type: 'slackListsTrigger',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

/** An axios-shaped connection failure, as the HTTP helper surfaces it. */
const networkError = (code: string) => Object.assign(new Error(code), { code });

describe('isTransientError', () => {
	it.each(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN'])(
		'treats the network error %s as transient',
		(code) => {
			expect(isTransientError(networkError(code))).toBe(true);
		},
	);

	it.each(['429', '500', '503'])('treats HTTP %s as transient', (httpCode) => {
		const error = new NodeApiError(node, { message: 'boom' }, { httpCode });
		expect(isTransientError(error)).toBe(true);
	});

	it('sees through the NodeApiError wrapper to the original network error', () => {
		const error = new NodeApiError(node, networkError('ETIMEDOUT'));
		expect(isTransientError(error)).toBe(true);
	});

	it.each(['400', '401', '403', '404'])('does not treat HTTP %s as transient', (httpCode) => {
		const error = new NodeApiError(node, { message: 'boom' }, { httpCode });
		expect(isTransientError(error)).toBe(false);
	});

	it("does not retry Slack's own error responses", () => {
		const error = new NodeApiError(node, { ok: false, error: 'invalid_auth' });
		expect(isTransientError(error)).toBe(false);
	});

	it('ignores non-Error values', () => {
		expect(isTransientError('ETIMEDOUT')).toBe(false);
		expect(isTransientError(undefined)).toBe(false);
	});
});

describe('retryOnTransientError', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('does not retry a call that succeeds', async () => {
		const fn = vi.fn().mockResolvedValue('ok');
		await expect(retryOnTransientError(fn)).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('retries a transient failure and returns the eventual success', async () => {
		const fn = vi.fn().mockRejectedValueOnce(networkError('ETIMEDOUT')).mockResolvedValue('ok');

		const result = retryOnTransientError(fn);
		await vi.runAllTimersAsync();

		await expect(result).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('gives up after MAX_TRIES attempts and rethrows the last error', async () => {
		const error = networkError('ETIMEDOUT');
		const fn = vi.fn().mockRejectedValue(error);

		// Attach the rejection handler before the timers run, so the failing
		// attempts never look like an unhandled rejection.
		const assertion = expect(retryOnTransientError(fn)).rejects.toBe(error);
		await vi.runAllTimersAsync();

		await assertion;
		expect(fn).toHaveBeenCalledTimes(MAX_TRIES);
	});

	it('waits 5 seconds between attempts', async () => {
		const fn = vi.fn().mockRejectedValueOnce(networkError('ETIMEDOUT')).mockResolvedValue('ok');

		const result = retryOnTransientError(fn);
		await vi.advanceTimersByTimeAsync(4999);
		expect(fn).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(1);
		await expect(result).resolves.toBe('ok');
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it('rethrows a non-transient error immediately', async () => {
		const error = new NodeApiError(node, { ok: false, error: 'invalid_auth' });
		const fn = vi.fn().mockRejectedValue(error);

		await expect(retryOnTransientError(fn)).rejects.toBe(error);
		expect(fn).toHaveBeenCalledTimes(1);
	});
});
