export const CORPUS_SCHEMA_VERSION = "1.0.0" as const;

export type CorpusDocumentType = "text" | "markdown";

export type ArtifactMetadata = {
  source: string;
  filename: string;
  documentType: CorpusDocumentType;
  title: string | null;
  section: string | null;
  tags: string[];
  author: string | null;
  timestamp: string | null;
  role: string | null;
  scope: string | null;
  keywords: string[];
};

export type CorpusDocument = {
  id: string;
  cid: string;
  schemaVersion: typeof CORPUS_SCHEMA_VERSION;
  sourceHash: string;
  metadata: ArtifactMetadata;
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
};

export type CorpusChunk = {
  cid: string;
  documentId: string;
  chunkId: string;
  content: string;
  metadata: ArtifactMetadata;
  createdAt: string;
  sourceHash: string;
  chunkHash: string;
  tokenStart: number;
  tokenEnd: number;
  schemaVersion: typeof CORPUS_SCHEMA_VERSION;
};

/** MIST will add layer membership and trajectory data in a later phase. */
export type CorpusArtifact = CorpusChunk;

/** Embeddings are stored separately from source chunks and are not generated in Phase 2. */
export type CorpusEmbedding = {
  chunkCid: string;
  model: string;
  modelVersion: string;
  vector: number[];
  createdAt: string;
  schemaVersion: typeof CORPUS_SCHEMA_VERSION;
};

export type CorpusIngestInput = {
  filename: string;
  content: string;
  mimeType: "text/plain" | "text/markdown";
  source?: string;
  title?: string;
  tags?: string[];
  author?: string;
  timestamp?: string;
  role?: string;
  scope?: string;
  keywords?: string[];
  targetTokens?: number;
  overlapTokens?: number;
};

export type CorpusIngestResult = {
  document: CorpusDocument;
  chunks: CorpusChunk[];
  warnings: string[];
};

export type CorpusSearchQuery = {
  query: string;
  documentId?: string;
  limit?: number;
};

export type CorpusSearchResult = {
  artifact: CorpusArtifact;
  score: number;
  matchedTokens: string[];
  mode: "storage_lookup";
};

export type CorpusStoreStats = {
  documents: number;
  chunks: number;
  embeddings: number;
  storage: "indexeddb" | "memory";
  storageBytes: null;
};
