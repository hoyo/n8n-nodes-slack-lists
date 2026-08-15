import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';
import {
	buildCells,
	buildCellValue,
	getColumnValues,
	simplifyItem,
	toRichTextBlocks,
} from '../shared/cells';
import type { ListColumn } from '../shared/schema';

const column = (overrides: Partial<ListColumn>): ListColumn => ({
	id: 'Col1',
	name: 'Column',
	key: 'col1',
	type: 'text',
	...overrides,
});

describe('toRichTextBlocks', () => {
	it('wraps plain text into the minimal rich_text structure', () => {
		expect(toRichTextBlocks('hello')).toEqual([
			{
				type: 'rich_text',
				elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: 'hello' }] }],
			},
		]);
	});
});

describe('buildCellValue', () => {
	it('converts plain text to rich_text for text columns', () => {
		expect(buildCellValue(column({ type: 'text' }), 'memo')).toEqual({
			rich_text: toRichTextBlocks('memo'),
		});
	});

	it('passes through pre-built rich_text arrays for text columns', () => {
		const blocks = toRichTextBlocks('already rich');
		expect(buildCellValue(column({ type: 'text' }), blocks)).toEqual({ rich_text: blocks });
	});

	it('wraps single select values into an array', () => {
		expect(buildCellValue(column({ type: 'select' }), 'OptA')).toEqual({ select: ['OptA'] });
	});

	it('splits comma-separated user IDs', () => {
		expect(buildCellValue(column({ type: 'user' }), 'U01, U02')).toEqual({ user: ['U01', 'U02'] });
	});

	it('maps todo_assignee to the user property', () => {
		expect(buildCellValue(column({ type: 'todo_assignee' }), 'U01')).toEqual({ user: ['U01'] });
	});

	it('converts checkbox and todo_completed values to booleans', () => {
		expect(buildCellValue(column({ type: 'checkbox' }), true)).toEqual({ checkbox: true });
		expect(buildCellValue(column({ type: 'todo_completed' }), 0)).toEqual({ checkbox: false });
	});

	it('converts numbers and ratings to numeric arrays', () => {
		expect(buildCellValue(column({ type: 'number' }), '42')).toEqual({ number: [42] });
		expect(buildCellValue(column({ type: 'rating' }), 3)).toEqual({ rating: [3] });
	});

	it('formats date columns as YYYY-MM-DD', () => {
		expect(buildCellValue(column({ type: 'date' }), '2026-07-19T10:30:00.000Z')).toEqual({
			date: ['2026-07-19'],
		});
	});

	it('converts timestamp columns to unix seconds', () => {
		expect(buildCellValue(column({ type: 'timestamp' }), '2026-07-19T00:00:00.000Z')).toEqual({
			timestamp: [Date.UTC(2026, 6, 19) / 1000],
		});
	});

	it('wraps plain URLs into link objects', () => {
		expect(buildCellValue(column({ type: 'link' }), 'https://example.com')).toEqual({
			link: [{ original_url: 'https://example.com' }],
		});
	});

	it('keeps link objects as-is', () => {
		const link = { original_url: 'https://example.com', display_name: 'Example' };
		expect(buildCellValue(column({ type: 'link' }), [link])).toEqual({ link: [link] });
	});

	it('wraps emails and phones into arrays', () => {
		expect(buildCellValue(column({ type: 'email' }), 'a@example.com')).toEqual({
			email: ['a@example.com'],
		});
		expect(buildCellValue(column({ type: 'phone' }), '+81-90-0000-0000')).toEqual({
			phone: ['+81-90-0000-0000'],
		});
	});
});

describe('buildCells', () => {
	const ctx = {
		getNode: () => ({ name: 'Slack Lists' }),
	} as unknown as IExecuteFunctions;

	const schema: ListColumn[] = [
		column({ id: 'ColText', type: 'text', name: 'Title' }),
		column({ id: 'ColSelect', type: 'select', name: 'Status' }),
		column({ id: 'ColCreated', type: 'created_time', name: 'Created' }),
	];

	it('builds one cell per non-empty value with column_id', () => {
		const cells = buildCells.call(ctx, schema, { ColText: 'hello', ColSelect: 'OptA' });
		expect(cells).toEqual([
			{ column_id: 'ColText', rich_text: toRichTextBlocks('hello') },
			{ column_id: 'ColSelect', select: ['OptA'] },
		]);
	});

	it('skips empty values and read-only columns', () => {
		const cells = buildCells.call(ctx, schema, {
			ColText: '',
			ColSelect: null,
			ColCreated: 12345,
		});
		expect(cells).toEqual([]);
	});

	it('throws for unknown column IDs', () => {
		expect(() => buildCells.call(ctx, schema, { ColNope: 'x' })).toThrow(NodeOperationError);
	});
});

describe('getColumnValues', () => {
	const schema: ListColumn[] = [
		column({ id: 'ColTitle', name: 'タイトル', key: 'title', type: 'text' }),
		column({ id: 'ColUser', name: '担当者', key: 'assignee', type: 'user' }),
		column({ id: 'ColCreated', name: '作成日時', key: 'created', type: 'created_time' }),
	];

	const makeCtx = (params: IDataObject, inputJson: IDataObject = {}) =>
		({
			getNodeParameter: vi.fn((name: string, _i: number, fallback?: unknown) => {
				return name in params ? params[name] : fallback;
			}),
			getInputData: () => [{ json: inputJson }],
		}) as unknown as IExecuteFunctions;

	it('returns the mapped values in defineBelow mode', () => {
		const ctx = makeCtx({
			'columns.mappingMode': 'defineBelow',
			'columns.value': { ColTitle: 'hello' },
		});
		expect(getColumnValues.call(ctx, 0, schema)).toEqual({ ColTitle: 'hello' });
	});

	it('matches input JSON keys by column name, ID and key in autoMapInputData mode', () => {
		const ctx = makeCtx(
			{ 'columns.mappingMode': 'autoMapInputData' },
			{ タイトル: 'by name', ColUser: 'by id', ignored: 'x' },
		);
		expect(getColumnValues.call(ctx, 0, schema)).toEqual({
			ColTitle: 'by name',
			ColUser: 'by id',
		});
	});

	it('never auto-maps read-only columns', () => {
		const ctx = makeCtx({ 'columns.mappingMode': 'autoMapInputData' }, { 作成日時: 123 });
		expect(getColumnValues.call(ctx, 0, schema)).toEqual({});
	});
});

describe('simplifyItem', () => {
	// Modeled on real slackLists.items.list responses
	const schema: ListColumn[] = [
		column({ id: 'ColTitle', name: 'タイトル', key: 'title', type: 'text' }),
		column({
			id: 'ColStatus',
			name: '対応状況',
			key: 'status',
			type: 'select',
			options: { format: 'single_select', choices: [{ value: 'day_3', label: '3営' }] },
		}),
		column({
			id: 'ColAssignee',
			name: '担当者',
			key: 'assignee',
			type: 'user',
			options: { format: 'single_entity' },
		}),
		column({
			id: 'ColMembers',
			name: 'メンバー',
			key: 'members',
			type: 'user',
			options: { format: 'multi_entity' },
		}),
	];

	const record: IDataObject = {
		id: 'Rec01',
		list_id: 'F01',
		date_created: 1782707931,
		created_by: 'U01',
		updated_by: 'U02',
		updated_timestamp: '1782707960',
		fields: [
			{
				key: 'title',
				value: '[{"type":"rich_text"}]',
				text: '請求書発行',
				rich_text: [],
				column_id: 'ColTitle',
			},
			{ key: 'status', value: 'day_3', select: ['day_3'], column_id: 'ColStatus' },
			{ key: 'assignee', value: 'U03', user: ['U03'], column_id: 'ColAssignee' },
			{ key: 'members', user: ['U03', 'U04'], column_id: 'ColMembers' },
			{ key: 'todo_completed', value: false, checkbox: false, column_id: 'Col00' },
		],
	};

	it('converts fields into a name-keyed object with plain values', () => {
		expect(simplifyItem(record, schema)).toEqual({
			id: 'Rec01',
			list_id: 'F01',
			date_created: '2026-06-29T04:38:51.000Z',
			created_by: 'U01',
			updated_by: 'U02',
			// Slack sends this one as a string; it is normalised just the same.
			updated_timestamp: '2026-06-29T04:39:20.000Z',
			fields: {
				タイトル: '請求書発行',
				対応状況: 'day_3',
				担当者: 'U03',
				メンバー: ['U03', 'U04'],
				todo_completed: false,
			},
		});
	});

	it('keeps empty text cells as empty strings', () => {
		const empty: IDataObject = {
			id: 'Rec02',
			fields: [{ key: 'title', value: null, text: '', rich_text: [], column_id: 'ColTitle' }],
		};
		const simplified = simplifyItem(empty, schema);
		expect((simplified.fields as IDataObject)['タイトル']).toBe('');
	});

	it('includes parent_record_id only when present', () => {
		const subtask = { ...record, parent_record_id: 'Rec00' };
		expect(simplifyItem(subtask, schema).parent_record_id).toBe('Rec00');
		expect(simplifyItem(record, schema)).not.toHaveProperty('parent_record_id');
	});
});
