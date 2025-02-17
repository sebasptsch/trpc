import { createQueryClient } from '../__queryClient';
import { createAppRouter, Post } from './__testHelpers';
import { createQueryUtils } from '@trpc/react-query';

let factory: ReturnType<typeof createAppRouter>;
beforeEach(() => {
  factory = createAppRouter();
});
afterEach(async () => {
  await factory.close();
});

describe('createQueryUtils()', () => {
  test('ensureData()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    async function prefetch() {
      const initialQuery = await clientUtils.postById.ensureData('1');
      expect(initialQuery.title).toBe('first post');

      const cachedQuery = await clientUtils.postById.ensureData('1');
      expect(cachedQuery.title).toBe('first post');

      // Update data to invalidate the cache
      clientUtils.postById.setData('1', () => {
        return {
          id: 'id',
          title: 'updated post',
          createdAt: Date.now(),
        };
      });

      const updatedQuery = await clientUtils.postById.ensureData('1');
      expect(updatedQuery.title).toBe('updated post');
    }
    await prefetch();

    // Because we are using `ensureData` here, it should always be only a single call
    // as the first invocation will fetch and cache the data, and any consecutive calls
    // will not go through `postById.fetch`, but rather get the data directly from cache.
    //
    // Calling `postById.setData` updates the cache as well, so even after update
    // number of direct calls should still be 1.
    expect(factory.resolvers.postById.mock.calls.length).toBe(1);
    expect(factory.resolvers.postById.mock.calls[0]![0]).toBe('1');
  });

  test('fetchQuery()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    const query = await clientUtils.postById.fetch('1');
    expect(query.title).toBe('first post');
  });

  test('fetchInfiniteQuery()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    const q = await clientUtils.paginatedPosts.fetchInfinite(
      {
        limit: 1,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.cursor,
      },
    );

    expectTypeOf(q.pages[0]!.items).toMatchTypeOf<Post[] | undefined>();
    expect(q.pages[0]!.items[0]!.title).toBe('first post');
  });

  test('prefetchQuery()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    await clientUtils.postById.prefetch('1');

    // Because we are using `prefetchQuery` here, it should always be only a single call
    // as the first invocation will fetch and cache the data, and any consecutive calls
    // will not go through `postById.fetch`, but rather get the data directly from cache.
    expect(factory.resolvers.postById.mock.calls.length).toBe(1);
    expect(factory.resolvers.postById.mock.calls[0]![0]).toBe('1');
  });

  test('prefetchInfiniteQuery()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    await clientUtils.paginatedPosts.prefetchInfinite(
      {
        limit: 1,
      },
      {
        getNextPageParam: (lastPage) => lastPage?.cursor,
      },
    );

    // Because we are using `prefetchInfiniteQuery` here, it should always be only a single call
    // as the first invocation will fetch and cache the data, and any consecutive calls
    // will not go through `paginatedPosts.fetchInfinite`, but rather get the data directly from cache.
    expect(factory.resolvers.paginatedPosts.mock.calls.length).toBe(1);
  });

  test('invalidateQueries()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    await clientUtils.postById.fetch('1');

    expect(factory.resolvers.postById.mock.calls.length).toBe(1);
    expect(factory.resolvers.postById.mock.calls[0]![0]).toBe('1');

    await clientUtils.postById.invalidate('1', {
      refetchType: 'all',
    });

    // The cache should be invalidated, so this should be a new call
    expect(factory.resolvers.postById.mock.calls.length).toBe(2);
    expect(factory.resolvers.postById.mock.calls[1]![0]).toBe('1');
  });

  test('resetQueries()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    await clientUtils.postById.fetch('1', {
      initialData: {
        createdAt: Date.now(),
        id: '1',
        title: 'first post, reset',
      },
    });

    expect(factory.resolvers.postById.mock.calls.length).toBe(1);
    expect(factory.resolvers.postById.mock.calls[0]![0]).toBe('1');

    expect(clientUtils.postById.getData('1')?.title).toBe('first post');

    await clientUtils.postById.reset('1');

    // The cache should have the initial data if you check it
    const data = clientUtils.postById.getData('1');

    expect(data?.title).toBe('first post, reset');
  });

  test('refetchQueries()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });

    await clientUtils.postById.fetch('1');

    expect(factory.resolvers.postById.mock.calls.length).toBe(1);
    expect(factory.resolvers.postById.mock.calls[0]![0]).toBe('1');

    await clientUtils.postById.refetch('1');

    // The cache should be invalidated, so this should be a new call
    expect(factory.resolvers.postById.mock.calls.length).toBe(2);
    expect(factory.resolvers.postById.mock.calls[1]![0]).toBe('1');
  });

  test('setQueriesData()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });
    const data: Post = {
      createdAt: Date.now(),
      id: '1',
      title: 'first post, setQueriesData',
    };

    clientUtils.postById.setData('1', data);

    expect(clientUtils.postById.getData('1')).toEqual(data);
  });

  test('cancelQuery()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });
    clientUtils.postById.fetch('1', {
      queryFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return 'never returned';
      },
    });
    await clientUtils.postById.cancel('1');
    expect(factory.resolvers.postById.mock.calls.length).toBe(0);
  });

  test('getQueryData()', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });
    const data: Post = {
      createdAt: Date.now(),
      id: '1',
      title: 'first post, getQueryData',
    };

    clientUtils.postById.setData('1', data);

    expect(clientUtils.postById.getData('1')).toEqual(data);
  });

  test('set and get infinite query data', async () => {
    const { client } = factory;
    const queryClient = createQueryClient();
    const clientUtils = createQueryUtils({ queryClient, client });
    const createdAt = Date.now();

    clientUtils.paginatedPosts.setInfiniteData(
      {},
      {
        pages: [
          {
            items: [
              {
                id: 'id',
                title: 'infinitePosts.title1',
                createdAt,
              },
            ],
            nextCursor: null,
          },
        ],
        pageParams: [],
      },
    );

    expect(clientUtils.paginatedPosts.getInfiniteData({})).toEqual({
      pages: [
        {
          items: [
            {
              id: 'id',
              title: 'infinitePosts.title1',
              createdAt,
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [],
    });
  });
});
