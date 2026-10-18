import type {
  CorpusArtifact,
  CorpusChunk,
  CorpusDocument,
  CorpusEmbedding,
  CorpusSearchQuery,
  CorpusSearchResult,
  CorpusStoreStats,
} from "../corpus/types";

/**
 * Physical-storage boundary for KEIRA corpus data. MIST must depend on this
 * interface rather than IndexedDB or any future storage engine directly.
 */
export interface CorpusStore {
  putDocument(document: CorpusDocument): Promise<void>;
  putChunk(chunk: CorpusChunk): Promise<void>;
  putEmbedding(embedding: CorpusEmbedding): Promise<void>;
  getEmbedding(chunkCid: string): Promise<CorpusEmbedding | undefined>;
  getByCid(cid: string): Promise<CorpusArtifact | undefined>;
  listDocuments(): Promise<CorpusDocument[]>;
  listChunks(documentId?: string): Promise<CorpusChunk[]>;
  deleteDocument(documentId: string): Promise<void>;
  search(query: CorpusSearchQuery): Promise<CorpusSearchResult[]>;
  getStats(): Promise<CorpusStoreStats>;
}
