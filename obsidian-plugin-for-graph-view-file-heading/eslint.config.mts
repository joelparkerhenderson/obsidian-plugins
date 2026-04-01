import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json',
						'vitest.config.ts',
						'src/main.test.ts'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		files: ['src/**/*.ts'],
		rules: {
			'obsidianmd/commands/no-command-in-command-id': 'error',
			'obsidianmd/commands/no-command-in-command-name': 'error',
			'obsidianmd/commands/no-default-hotkeys': 'warn',
			'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
			'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
			'obsidianmd/detach-leaves': 'error',
			'obsidianmd/hardcoded-config-path': 'warn',
			'obsidianmd/no-forbidden-elements': 'error',
			'obsidianmd/no-plugin-as-component': 'error',
			'obsidianmd/no-sample-code': 'error',
			'obsidianmd/no-static-styles-assignment': 'warn',
			'obsidianmd/no-tfile-tfolder-cast': 'error',
			'obsidianmd/no-view-references-in-plugin': 'error',
			'obsidianmd/object-assign': 'warn',
			'obsidianmd/platform': 'error',
			'obsidianmd/prefer-abstract-input-suggest': 'error',
			'obsidianmd/prefer-file-manager-trash-file': 'error',
			'obsidianmd/regex-lookbehind': 'error',
			'obsidianmd/sample-names': 'warn',
			'obsidianmd/settings-tab/no-manual-html-headings': 'error',
			'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',
			'obsidianmd/ui/sentence-case': 'warn',
			'obsidianmd/vault/iterate': 'error',
		},
	},
	{
		files: ['src/**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/unbound-method': 'off',
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
