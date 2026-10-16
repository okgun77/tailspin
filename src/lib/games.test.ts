import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGames,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        /** Seeds two categories, two publishers and three games; returns their ids. */
        async function seedFilterData(): Promise<{ catA: number; catB: number; pubX: number; pubY: number }> {
            const [catA, catB] = await db
                .insert(categories)
                .values([
                    { name: 'Cat A', description: 'a' },
                    { name: 'Cat B', description: 'b' },
                ])
                .returning({ id: categories.id });
            const [pubX, pubY] = await db
                .insert(publishers)
                .values([
                    { name: 'Pub X', description: 'x' },
                    { name: 'Pub Y', description: 'y' },
                ])
                .returning({ id: publishers.id });
            await db.insert(games).values([
                { title: 'G1', description: 'd', categoryId: catA.id, publisherId: pubX.id },
                { title: 'G2', description: 'd', categoryId: catA.id, publisherId: pubY.id },
                { title: 'G3', description: 'd', categoryId: catB.id, publisherId: pubX.id },
            ]);
            return { catA: catA.id, catB: catB.id, pubX: pubX.id, pubY: pubY.id };
        }

        /** Extracts titles from a game list. */
        const titles = (list: { title: string }[]): string[] => list.map((g) => g.title);

        it('returns all games when no filters are given', async () => {
            await seedFilterData();
            expect(titles(await getGames(db))).toEqual(['G1', 'G2', 'G3']);
            expect(titles(await getGames(db, { categoryIds: [] }))).toEqual(['G1', 'G2', 'G3']);
        });

        it('filters by a single category', async () => {
            const { catB } = await seedFilterData();
            expect(titles(await getGames(db, { categoryIds: [catB] }))).toEqual(['G3']);
        });

        it('filters by multiple categories (OR)', async () => {
            const { catA, catB } = await seedFilterData();
            expect(titles(await getGames(db, { categoryIds: [catA, catB] }))).toEqual(['G1', 'G2', 'G3']);
        });

        it('filters by publisher', async () => {
            const { pubX } = await seedFilterData();
            expect(titles(await getGames(db, { publisherId: pubX }))).toEqual(['G1', 'G3']);
        });

        it('combines category and publisher filters (AND)', async () => {
            const { catA, pubX } = await seedFilterData();
            expect(titles(await getGames(db, { categoryIds: [catA], publisherId: pubX }))).toEqual(['G1']);
        });

        it('returns an empty list when nothing matches', async () => {
            const { catB, pubY } = await seedFilterData();
            expect(await getGames(db, { categoryIds: [catB], publisherId: pubY })).toEqual([]);
        });

        it('lists categories and publishers ordered by name', async () => {
            await seedFilterData();
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Cat A', 'Cat B']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Pub X', 'Pub Y']);
        });
    });
});
