import { z } from 'zod';
import { insertUserSchema, insertWordSchema, insertPassageSchema, word, userWordProgress, passage, vocabList, type UserWordProgress, type Passage, type VocabList } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  words: {
    list: {
      method: 'GET' as const,
      path: '/api/words' as const,
      responses: {
        200: z.array(z.object({
          wordId: z.number(),
          term: z.string(),
          definition: z.string(),
          phonetic: z.string().nullable(),
          audioUrl: z.string().nullish(),
          imageUrl: z.string().nullish(),
          userWordProgress: z.object({
            userWordId: z.number(),
            userId: z.number(),
            wordId: z.number(),
            status: z.string(),
            timesSeen: z.number(),
            lastSeenAt: z.union([z.string(), z.date()]).nullable(),
          }).optional(),
        })),
      },
    },
  },
  wordProgress: {
    update: {
      method: 'PATCH' as const,
      path: '/api/word-progress/:userWordId' as const,
      responses: {
        200: z.object({
          userWordId: z.number(),
          userId: z.number(),
          wordId: z.number(),
          status: z.string(),
          timesSeen: z.number(),
          lastSeenAt: z.date().nullable(),
        }),
        404: errorSchemas.notFound,
      },
    },
  },
  addToVocab: {
    method: 'POST' as const,
    path: '/api/add-to-vocab' as const,
    body: z.object({ term: z.string() }),
    responses: {
      200: z.object({ wordId: z.number(), term: z.string() }),
      400: errorSchemas.validation,
    },
  },
  readingPassages: {
    list: {
        method: 'GET' as const,
        path: '/api/reading-passages' as const,
        responses: {
            200: z.array(z.custom<Passage>()),
        },
    },
    get: {
        method: 'GET' as const,
        path: '/api/reading-passages/:id' as const,
        responses: {
            200: z.custom<Passage>(),
            404: errorSchemas.notFound,
        },
    }
  },
  vocabLists: {
    list: {
      method: 'GET' as const,
      path: '/api/vocab-lists' as const,
      responses: {
        200: z.array(z.object({
          vocabListId: z.number(),
          name: z.string(),
          createdAt: z.string().or(z.date()),
          wordCount: z.number().optional(),
        })),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/vocab-lists' as const,
      body: z.object({
        name: z.string().min(1),
      }),
      responses: {
        201: z.custom<VocabList>(),
        400: errorSchemas.validation,
      },
    },
    words: {
      list: {
        method: 'GET' as const,
        path: '/api/vocab-lists/:listId/words' as const,
        responses: {
          200: z.array(z.object({
            wordId: z.number(),
            term: z.string(),
            definition: z.string(),
            phonetic: z.string().nullish(),
            audioUrl: z.string().nullish(),
            imageUrl: z.string().nullish(),
          })),
          404: errorSchemas.notFound,
        },
      },
      add: {
        method: 'POST' as const,
        path: '/api/vocab-lists/:listId/words' as const,
        body: z.object({
          wordId: z.number(),
        }),
        responses: {
          201: z.object({
            vocabListWordId: z.number(),
            vocabListId: z.number(),
            wordId: z.number(),
          }),
          404: errorSchemas.notFound,
        },
      },
      addFromTerm: {
        method: 'POST' as const,
        path: '/api/vocab-lists/:listId/words-from-term' as const,
        body: z.object({
          term: z.string().min(1),
        }),
        responses: {
          201: z.object({
            vocabListWordId: z.number(),
            vocabListId: z.number(),
            wordId: z.number(),
          }),
          404: errorSchemas.notFound,
        },
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
