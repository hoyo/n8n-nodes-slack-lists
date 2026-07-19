import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLists } from '../methods/listSearch';
import { slackApiRequest } from '../shared/transport';

vi.mock('../shared/transport', () => ({
	slackApiRequest: vi.fn(),
}));

const ctx = {} as ILoadOptionsFunctions;

const filesResponse = {
	ok: true,
	files: [
		{ id: 'F01', title: '決算テスト', filetype: 'list', permalink: 'https://x.slack.com/lists/T1/F01' },
		{ id: 'F02', title: 'テンプレート', filetype: 'list_template', permalink: 'https://x/F02' },
		{ id: 'F03', title: 'UAT バグリスト', filetype: 'list', permalink: 'https://x/F03' },
	],
	paging: { count: 100, total: 150, page: 1, pages: 2 },
};

describe('getLists', () => {
	beforeEach(() => {
		vi.mocked(slackApiRequest).mockReset();
		vi.mocked(slackApiRequest).mockResolvedValue(filesResponse as never);
	});

	it('queries files.list with types=list and maps results', async () => {
		const result = await getLists.call(ctx);
		expect(vi.mocked(slackApiRequest).mock.calls[0]).toEqual([
			'GET',
			'/files.list',
			{},
			{ types: 'list', count: 100, page: 1 },
		]);
		expect(result.results).toEqual([
			{ name: '決算テスト', value: 'F01', url: 'https://x.slack.com/lists/T1/F01' },
			{ name: 'UAT バグリスト', value: 'F03', url: 'https://x/F03' },
		]);
	});

	it('excludes list templates', async () => {
		const result = await getLists.call(ctx);
		expect(result.results.map((entry) => entry.value)).not.toContain('F02');
	});

	it('filters by title case-insensitively', async () => {
		const result = await getLists.call(ctx, 'uat');
		expect(result.results.map((entry) => entry.value)).toEqual(['F03']);
	});

	it('returns the next page number as pagination token', async () => {
		const result = await getLists.call(ctx);
		expect(result.paginationToken).toBe('2');
	});

	it('omits the pagination token on the last page', async () => {
		vi.mocked(slackApiRequest).mockResolvedValue({
			...filesResponse,
			paging: { count: 100, total: 150, page: 2, pages: 2 },
		} as never);
		const result = await getLists.call(ctx, undefined, '2');
		expect(vi.mocked(slackApiRequest).mock.calls[0][3]).toMatchObject({ page: 2 });
		expect(result.paginationToken).toBeUndefined();
	});
});
