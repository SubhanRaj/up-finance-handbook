import Dexie, { type EntityTable } from 'dexie';

export type CachedPage = {
	slug: string;
	volume: string;
	title: string;
	sourceUrl: string;
	html: string;
	text: string;
};

const db = new Dexie('up-finance-handbook') as Dexie & {
	pages: EntityTable<CachedPage, 'slug'>;
};

db.version(1).stores({
	pages: 'slug, volume',
});

export { db };
