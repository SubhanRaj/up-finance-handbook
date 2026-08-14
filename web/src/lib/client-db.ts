import Dexie, { type EntityTable } from 'dexie';

export type CachedPage = {
	slug: string;
	volume: string;
	title: string;
	sourceUrl: string;
	html: string;
	text: string;
};

export type Bookmark = {
	id?: number;
	text: string;
	slug: string;
	pageTitle: string;
	volumeLabel: string;
	createdAt: number;
};

const db = new Dexie('up-finance-handbook') as Dexie & {
	pages: EntityTable<CachedPage, 'slug'>;
	bookmarks: EntityTable<Bookmark, 'id'>;
};

db.version(1).stores({
	pages: 'slug, volume',
});
db.version(2).stores({
	pages: 'slug, volume',
	bookmarks: '++id, slug, createdAt',
});

/** Fired on window after a bookmark is added/removed, so BookmarksDrawer can refetch without a live-query dependency. */
export const BOOKMARKS_CHANGED_EVENT = 'handbook-bookmarks-changed';

export function notifyBookmarksChanged() {
	window.dispatchEvent(new Event(BOOKMARKS_CHANGED_EVENT));
}

export { db };
