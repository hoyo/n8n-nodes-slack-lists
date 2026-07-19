import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getColumns } from '../methods/resourceMapping';
import type { ListColumn } from '../shared/schema';
import { getListInfo } from '../shared/schema';

vi.mock('../shared/schema', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../shared/schema')>();
	return { ...actual, getListInfo: vi.fn() };
});

const ctx = {
	getNodeParameter: vi.fn(() => 'F01'),
} as unknown as ILoadOptionsFunctions;

const schema: ListColumn[] = [
	{ id: 'ColText', name: 'タイトル', key: 'title', type: 'text', is_primary_column: true },
	{
		id: 'ColSelect',
		name: '状態',
		key: 'status',
		type: 'select',
		options: {
			format: 'single_select',
			choices: [
				{ value: 'OptA', label: 'オープン', color: 'blue' },
				{ value: 'OptB', label: 'クローズ', color: 'gray' },
			],
		},
	},
	{
		id: 'ColMultiSelect',
		name: 'タグ',
		key: 'tags',
		type: 'select',
		options: { format: 'multi_select', choices: [] },
	},
	{ id: 'ColUser', name: '担当者', key: 'assignee', type: 'user', options: { format: 'single_entity' } },
	{ id: 'ColUsers', name: 'メンバー', key: 'members', type: 'user', options: { format: 'multi_entity' } },
	{ id: 'ColCheck', name: '完了', key: 'done', type: 'checkbox' },
	{ id: 'ColNumber', name: '数量', key: 'qty', type: 'number' },
	{ id: 'ColDate', name: '期限', key: 'due', type: 'date' },
	{ id: 'ColLink', name: 'URL', key: 'url', type: 'link' },
	{ id: 'Col00', name: '完了済み', key: 'todo_completed', type: 'todo_completed' },
	{ id: 'ColCreated', name: '作成日時', key: 'created', type: 'created_time' },
	{ id: 'ColVote', name: '投票', key: 'vote', type: 'vote' },
];

describe('getColumns', () => {
	beforeEach(() => {
		vi.mocked(getListInfo).mockResolvedValue({
			id: 'F01',
			title: 'Test',
			schema,
			todoMode: false,
			file: {},
		});
	});

	it('excludes read-only column types', async () => {
		const { fields } = await getColumns.call(ctx);
		const ids = fields.map((field) => field.id);
		expect(ids).not.toContain('ColCreated');
		expect(ids).not.toContain('ColVote');
	});

	it('maps Slack column types to n8n field types', async () => {
		const { fields } = await getColumns.call(ctx);
		const typeOf = (id: string) => fields.find((field) => field.id === id)?.type;
		expect(typeOf('ColText')).toBe('string');
		expect(typeOf('ColSelect')).toBe('options');
		expect(typeOf('ColMultiSelect')).toBe('array');
		expect(typeOf('ColUser')).toBe('string');
		expect(typeOf('ColUsers')).toBe('array');
		expect(typeOf('ColCheck')).toBe('boolean');
		expect(typeOf('ColNumber')).toBe('number');
		expect(typeOf('ColDate')).toBe('dateTime');
		expect(typeOf('ColLink')).toBe('url');
		expect(typeOf('Col00')).toBe('boolean');
	});

	it('exposes select choices as labeled options', async () => {
		const { fields } = await getColumns.call(ctx);
		const select = fields.find((field) => field.id === 'ColSelect');
		expect(select?.options).toEqual([
			{ name: 'オープン', value: 'OptA' },
			{ name: 'クローズ', value: 'OptB' },
		]);
	});

	it('uses column display names', async () => {
		const { fields } = await getColumns.call(ctx);
		expect(fields.find((field) => field.id === 'ColText')?.displayName).toBe('タイトル');
	});
});
