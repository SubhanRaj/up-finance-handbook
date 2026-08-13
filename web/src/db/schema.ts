import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pages = sqliteTable('pages', {
	slug: text('slug').primaryKey(),
	volume: text('volume').notNull(),
	title: text('title').notNull(),
	sourceUrl: text('source_url').notNull(),
	html: text('html').notNull(),
});
