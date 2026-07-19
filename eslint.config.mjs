import { config } from '@n8n/node-cli/eslint';

export default [
	...config,
	{
		rules: {
			// This package intentionally references n8n's built-in Slack credential
			// ('slackApi' from n8n-nodes-base) so users can select their existing
			// Slack credentials instead of re-entering the token. Credential types
			// are resolved by name across packages at runtime, so this works on any
			// n8n instance. Trade-off: the package cannot pass n8n Cloud verification.
			'@n8n/community-nodes/no-credential-reuse': 'off',
		},
	},
	{
		// Test files and the vitest config are not shipped in dist, so the
		// n8n Cloud dependency restrictions do not apply to them.
		files: ['**/*.test.ts', 'vitest.config.ts'],
		rules: {
			'@n8n/community-nodes/no-restricted-imports': 'off',
			'@n8n/community-nodes/no-restricted-globals': 'off',
		},
	},
];
