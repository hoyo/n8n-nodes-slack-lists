import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { processItems, splitIds, toIsoString } from '../shared/utils';

const node = {
	id: '1',
	name: 'Slack Lists',
	type: 'slackLists',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

const makeCtx = (continueOnFail: boolean) =>
	({
		continueOnFail: () => continueOnFail,
		getNode: () => node,
		helpers: {
			returnJsonArray: (data: unknown) =>
				(Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (data: INodeExecutionData[], { itemData }: never) =>
				data.map((entry) => ({ ...entry, pairedItem: itemData })),
		},
	}) as unknown as IExecuteFunctions;

const items: INodeExecutionData[] = [{ json: { a: 1 } }, { json: { a: 2 } }];

describe('processItems', () => {
	it('runs the callback per item and attaches paired item metadata', async () => {
		const result = await processItems.call(makeCtx(false), items, async function (i) {
			return { index: i };
		});
		expect(result).toEqual([
			{ json: { index: 0 }, pairedItem: { item: 0 } },
			{ json: { index: 1 }, pairedItem: { item: 1 } },
		]);
	});

	it('flattens array results from a single item', async () => {
		const result = await processItems.call(makeCtx(false), [items[0]], async () => [
			{ a: 1 },
			{ a: 2 },
		]);
		expect(result).toHaveLength(2);
	});

	it('collects errors as items when continueOnFail is enabled', async () => {
		const result = await processItems.call(makeCtx(true), items, async function (i) {
			if (i === 0) throw new Error('boom');
			return { ok: true };
		});
		expect(result[0]).toEqual({ json: { error: 'boom' }, pairedItem: { item: 0 } });
		expect(result[1].json).toEqual({ ok: true });
	});

	it('wraps plain errors into NodeOperationError', async () => {
		await expect(
			processItems.call(makeCtx(false), items, async () => {
				throw new Error('plain');
			}),
		).rejects.toBeInstanceOf(NodeOperationError);
	});

	it('rethrows NodeApiError without double-wrapping', async () => {
		const apiError = new NodeApiError(node, { error: 'list_not_found' });
		await expect(
			processItems.call(makeCtx(false), items, async () => {
				throw apiError;
			}),
		).rejects.toBe(apiError);
	});
});

describe('splitIds', () => {
	it('splits on commas and trims whitespace', () => {
		expect(splitIds(' Rec01, Rec02 ,Rec03 ')).toEqual(['Rec01', 'Rec02', 'Rec03']);
	});

	it('drops empty entries', () => {
		expect(splitIds('Rec01,,')).toEqual(['Rec01']);
	});
});

describe('toIsoString', () => {
	it('converts unix seconds to an ISO 8601 string', () => {
		expect(toIsoString(1784589177)).toBe('2026-07-20T23:12:57.000Z');
	});

	it('accepts the numeric strings Slack sends for updated_timestamp', () => {
		expect(toIsoString('1784589177')).toBe('2026-07-20T23:12:57.000Z');
	});

	it('keeps the epoch itself rather than treating 0 as missing', () => {
		expect(toIsoString(0)).toBe('1970-01-01T00:00:00.000Z');
	});

	it.each([undefined, null, '', 'not-a-timestamp', NaN])(
		'returns undefined for %p so the field is dropped',
		(value) => {
			expect(toIsoString(value)).toBeUndefined();
		},
	);
});
