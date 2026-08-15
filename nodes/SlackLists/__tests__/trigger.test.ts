import type { IDataObject, IPollFunctions } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildListUpdateOutput, SlackListsTrigger } from '../SlackListsTrigger.node';
import { slackApiRequest } from '../shared/transport';

vi.mock('../shared/transport', () => ({
	slackApiRequest: vi.fn(),
}));

const node = {
	id: '1',
	name: 'Slack Lists Trigger',
	type: 'slackListsTrigger',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

const LIST_ID = 'F0BEU4URLDV';

function fileResponse(file: IDataObject = {}) {
	return {
		ok: true,
		file: {
			id: LIST_ID,
			title: 'Outlookカレンダー同期',
			updated: 1784589177,
			edit_timestamp: 1784589177,
			last_editor: 'U0ANGJRLU0K',
			permalink: 'https://estie.enterprise.slack.com/lists/TD3SM3NDB/F0BEU4URLDV',
			list_limits: { row_count: 5, row_count_limit: 5000 },
			list_metadata: { schema: [], todo_mode: false },
			...file,
		},
	};
}

function makeCtx(mode: 'trigger' | 'manual', staticData: IDataObject = {}) {
	const ctx = {
		getNode: () => node,
		getNodeParameter: vi.fn(() => LIST_ID),
		getMode: () => mode,
		getWorkflowStaticData: () => staticData,
		helpers: {
			returnJsonArray: (data: IDataObject | IDataObject[]) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
		},
	} as unknown as IPollFunctions;
	return { ctx, staticData };
}

const poll = (ctx: IPollFunctions) => new SlackListsTrigger().poll.call(ctx);

describe('SlackListsTrigger.poll', () => {
	beforeEach(() => {
		vi.mocked(slackApiRequest).mockReset();
		vi.mocked(slackApiRequest).mockResolvedValue(fileResponse() as never);
	});

	it('records the baseline and does not fire on the first poll', async () => {
		const { ctx, staticData } = makeCtx('trigger', {});
		const result = await poll(ctx);
		expect(result).toBeNull();
		expect(staticData.lastMaxTs).toBe(1784589177);
	});

	it('does not fire when the List has not changed since the last poll', async () => {
		const { ctx, staticData } = makeCtx('trigger', { lastMaxTs: 1784589177 });
		const result = await poll(ctx);
		expect(result).toBeNull();
		expect(staticData.lastMaxTs).toBe(1784589177);
	});

	it('fires and advances the watermark when the List was edited', async () => {
		vi.mocked(slackApiRequest).mockResolvedValue(
			fileResponse({ updated: 1784600000, edit_timestamp: 1784589177 }) as never,
		);
		const { ctx, staticData } = makeCtx('trigger', { lastMaxTs: 1784589177 });
		const result = await poll(ctx);
		expect(result).not.toBeNull();
		expect(result![0][0].json).toMatchObject({
			list_id: LIST_ID,
			title: 'Outlookカレンダー同期',
			updated: '2026-07-21T02:13:20.000Z',
			last_editor: 'U0ANGJRLU0K',
		});
		// The watermark itself stays a unix timestamp — only the output is ISO.
		expect(staticData.lastMaxTs).toBe(1784600000);
	});

	it('always returns the current state in manual mode without touching static data', async () => {
		const { ctx, staticData } = makeCtx('manual', {});
		const result = await poll(ctx);
		expect(result).not.toBeNull();
		expect(result![0][0].json.updated).toBe('2026-07-20T23:12:57.000Z');
		expect(staticData.lastMaxTs).toBeUndefined();
	});

	it('uses edit_timestamp when it is newer than updated', async () => {
		vi.mocked(slackApiRequest).mockResolvedValue(
			fileResponse({ updated: 1784500000, edit_timestamp: 1784600000 }) as never,
		);
		const { ctx } = makeCtx('manual');
		const result = await poll(ctx);
		expect(result![0][0].json.updated).toBe('2026-07-21T02:13:20.000Z');
	});

	it('uses updated when it is newer than edit_timestamp', async () => {
		vi.mocked(slackApiRequest).mockResolvedValue(
			fileResponse({ updated: 1784600000, edit_timestamp: 1784500000 }) as never,
		);
		const { ctx } = makeCtx('manual');
		const result = await poll(ctx);
		expect(result![0][0].json.updated).toBe('2026-07-21T02:13:20.000Z');
	});
});

describe('buildListUpdateOutput', () => {
	it('maps the raw files.info file onto the audit-friendly output shape, dropping the rest', () => {
		const output = buildListUpdateOutput(
			{
				id: 'F1',
				title: 'My List',
				last_editor: 'U1',
				permalink: 'https://x/F1',
				list_limits: { row_count: 42 },
			},
			1784600000,
		);
		expect(output).toEqual({
			list_id: 'F1',
			title: 'My List',
			updated: '2026-07-21T02:13:20.000Z',
			last_editor: 'U1',
			permalink: 'https://x/F1',
		});
	});
});
