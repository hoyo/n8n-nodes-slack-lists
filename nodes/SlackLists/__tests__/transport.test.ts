import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import { slackApiRequest, slackApiRequestAllItems } from '../shared/transport';

const node = {
	id: '1',
	name: 'Slack Lists',
	type: 'slackLists',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

const makeCtx = (responses: IDataObject[] | Error) => {
	const request =
		responses instanceof Error
			? vi.fn().mockRejectedValue(responses)
			: vi.fn(async () => responses.shift());
	const ctx = {
		getNode: () => node,
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as IExecuteFunctions;
	return { ctx, request };
};

describe('slackApiRequest', () => {
	it('returns the response body when ok is true', async () => {
		const { ctx, request } = makeCtx([{ ok: true, item: { id: 'Rec01' } }]);
		const response = await slackApiRequest.call(ctx, 'POST', '/slackLists.items.create', {
			list_id: 'F01',
		});
		expect(response.item).toEqual({ id: 'Rec01' });
		expect(request).toHaveBeenCalledWith(
			'slackApi',
			expect.objectContaining({
				method: 'POST',
				url: 'https://slack.com/api/slackLists.items.create',
				body: { list_id: 'F01' },
			}),
		);
	});

	it('throws a NodeApiError with the needed scope on missing_scope', async () => {
		const { ctx } = makeCtx([{ ok: false, error: 'missing_scope', needed: 'lists:read' }]);
		await expect(slackApiRequest.call(ctx, 'GET', '/slackLists.items.list')).rejects.toThrow(
			/lists:read/,
		);
	});

	it('throws a friendly message for paid_teams_only', async () => {
		const { ctx } = makeCtx([{ ok: false, error: 'paid_teams_only' }]);
		await expect(slackApiRequest.call(ctx, 'POST', '/slackLists.create')).rejects.toThrow(
			/paid Slack plans/,
		);
	});

	it('includes the error code for unmapped errors', async () => {
		const { ctx } = makeCtx([{ ok: false, error: 'some_new_error' }]);
		await expect(slackApiRequest.call(ctx, 'POST', '/slackLists.create')).rejects.toThrow(
			/some_new_error/,
		);
	});

	it('wraps transport-level failures into NodeApiError', async () => {
		const { ctx } = makeCtx(new Error('ECONNREFUSED'));
		await expect(slackApiRequest.call(ctx, 'GET', '/files.info')).rejects.toBeInstanceOf(
			NodeApiError,
		);
	});
});

describe('slackApiRequestAllItems', () => {
	it('follows next_cursor until exhausted, passing the cursor in the body for POST', async () => {
		const { ctx, request } = makeCtx([
			{ ok: true, items: [{ id: 1 }, { id: 2 }], response_metadata: { next_cursor: 'cur1' } },
			{ ok: true, items: [{ id: 3 }], response_metadata: { next_cursor: '' } },
		]);
		const items = await slackApiRequestAllItems.call(ctx, 'items', 'POST', '/slackLists.items.list', {
			list_id: 'F01',
		});
		expect(items.map((item) => item.id)).toEqual([1, 2, 3]);
		expect(request).toHaveBeenCalledTimes(2);
		const secondCallOptions = request.mock.calls[1][1] as IDataObject;
		expect((secondCallOptions.body as IDataObject).cursor).toBe('cur1');
	});

	it('stops early and truncates when maxResults is reached', async () => {
		const { ctx, request } = makeCtx([
			{ ok: true, items: [{ id: 1 }, { id: 2 }], response_metadata: { next_cursor: 'cur1' } },
			{ ok: true, items: [{ id: 3 }, { id: 4 }], response_metadata: { next_cursor: 'cur2' } },
		]);
		const items = await slackApiRequestAllItems.call(
			ctx,
			'items',
			'POST',
			'/slackLists.items.list',
			{ list_id: 'F01' },
			{},
			3,
		);
		expect(items).toHaveLength(3);
		expect(request).toHaveBeenCalledTimes(2);
	});

	it('handles responses without the collection property', async () => {
		const { ctx } = makeCtx([{ ok: true }]);
		const items = await slackApiRequestAllItems.call(ctx, 'items', 'POST', '/x');
		expect(items).toEqual([]);
	});
});
