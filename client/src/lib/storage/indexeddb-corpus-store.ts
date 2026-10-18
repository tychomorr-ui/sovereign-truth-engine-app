import { normalizeCorpusText, tokenizeCorpusText } from "../corpus/ingest";
import type {
  CorpusChunk,
  CorpusDocument,
  CorpusEmbedding,
  CorpusSearchQuery,
  CorpusSearchResult,
  CorpusStoreStats,
} from "../corpus/types";
import type { CorpusStore } from "./interface";

const DATABASE_VERSION = 1;
const DOCUMENTS = "documents";
const CHUNKS = "chunks";
const EMBEDDINGS = "embeddings";

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}

function uniqueTokens(value: string): string[] {
  return Array.from(new Set(tokenizeCorpusText(value.toLowerCase())));
}

/**
 * Browser-local corpus store. It contains no remote synchronization, no model
 * execution, and no MIST trajectory state. `search` is a storage-inspection
 * lexical lookup, not the Phase 4 MIST L1-L7 retrieval pipeline.
 */
export class IndexedDbCorpusStore implements CorpusStore {
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly databaseName = "keira-corpus",
    private readonly indexedDb: IDBFactory | undefined = globalThis.indexedDB,
  ) {}

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    if (!this.indexedDb) throw new Error("IndexedDB is unavailable in this browser.");

    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDb!.open(this.databaseName, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DOCUMENTS)) database.createObjectStore(DOCUMENTS, { keyPath: "id" });
        if (!database.objectStoreNames.contains(CHUNKS)) {
          const chunks = database.createObjectStore(CHUNKS, { keyPath: "cid" });
          chunks.createIndex("documentId", "documentId", { unique: false });
        }
        if (!database.objectStoreNames.contains(EMBEDDINGS)) {
          database.createObjectStore(EMBEDDINGS, { keyPath: "chunkCid" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to open KEIRA corpus storage."));
    });

    return this.databasePromise;
  }

  async putDocument(document: CorpusDocument): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(DOCUMENTS, "readwrite");
    transaction.objectStore(DOCUMENTS).put(document);
    await transactionDone(transaction);
  }

  async putChunk(chunk: CorpusChunk): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(CHUNKS, "readwrite");
    transaction.objectStore(CHUNKS).put(chunk);
    await transactionDone(transaction);
  }

  async putEmbedding(embedding: CorpusEmbedding): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(EMBEDDINGS, "readwrite");
    transaction.objectStore(EMBEDDINGS).put(embedding);
    await transactionDone(transaction);
  }

  async getEmbedding(chunkCid: string): Promise<CorpusEmbedding | undefined> {
    const database = await this.open();
    const transaction = database.transaction(EMBEDDINGS, "readonly");
    const result = await requestAsPromise(transaction.objectStore(EMBEDDINGS).get(chunkCid));
    await transactionDone(transaction);
    return result as CorpusEmbedding | undefined;
  }

  async getByCid(cid: string): Promise<CorpusChunk | undefined> {
    const database = await this.open();
    const transaction = database.transaction(CHUNKS, "readonly");
    const result = await requestAsPromise(transaction.objectStore(CHUNKS).get(cid));
    await transactionDone(transaction);
    return result as CorpusChunk | undefined;
  }

  async listDocuments(): Promise<CorpusDocument[]> {
    const database = await this.open();
    const transaction = database.transaction(DOCUMENTS, "readonly");
    const documents = await requestAsPromise(transaction.objectStore(DOCUMENTS).getAll());
    await transactionDone(transaction);
    return (documents as CorpusDocument[]).sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  async listChunks(documentId?: string): Promise<CorpusChunk[]> {
    const database = await this.open();
    const transaction = database.transaction(CHUNKS, "readonly");
    const chunks = await requestAsPromise(transaction.objectStore(CHUNKS).getAll());
    await transactionDone(transaction);
    return (chunks as CorpusChunk[])
      .filter((chunk) => !documentId || chunk.documentId === documentId)
      .sort((left, right) => left.documentId.localeCompare(right.documentId) || left.tokenStart - right.tokenStart || left.cid.localeCompare(right.cid));
  }

  async deleteDocument(documentId: string): Promise<void> {
    const database = await this.open();
    const chunks = await this.listChunks(documentId);
    const transaction = database.transaction([DOCUMENTS, CHUNKS, EMBEDDINGS], "readwrite");
    transaction.objectStore(DOCUMENTS).delete(documentId);
    for (const chunk of chunks) {
      transaction.objectStore(CHUNKS).delete(chunk.cid);
      transaction.objectStore(EMBEDDINGS).delete(chunk.cid);
    }
    await transactionDone(transaction);
  }

  async search(query: CorpusSearchQuery): Promise<CorpusSearchResult[]> {
    const normalizedQuery = normalizeCorpusText(query.query).toLowerCase();
    const queryTokens = uniqueTokens(normalizedQuery);
    if (!queryTokens.length) return [];
    const limit = Math.max(1, Math.min(200, Math.floor(query.limit ?? 50)));
    const chunks = await this.listChunks(query.documentId);
    return chunks
      .map((artifact) => {
        const artifactTokens = new Set(uniqueTokens(artifact.content.toLowerCase()));
        const matchedTokens = queryTokens.filter((token) => artifactTokens.has(token));
        return {
          artifact,
          matchedTokens,
          score: matchedTokens.length / queryTokens.length,
          mode: "storage_lookup" as const,
        };
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score || left.artifact.cid.localeCompare(right.artifact.cid))
      .slice(0, limit);
  }

  async getStats(): Promise<CorpusStoreStats> {
    const database = await this.open();
    const transaction = database.transaction([DOCUMENTS, CHUNKS, EMBEDDINGS], "readonly");
    const [documents, chunks, embeddings] = await Promise.all([
      requestAsPromise(transaction.objectStore(DOCUMENTS).count()),
      requestAsPromise(transaction.objectStore(CHUNKS).count()),
      requestAsPromise(transaction.objectStore(EMBEDDINGS).count()),
    ]);
    await transactionDone(transaction);
    return { documents, chunks, embeddings, storage: "indexeddb", storageBytes: null };
  }

  close(): void {
    this.databasePromise?.then((database) => database.close()).catch(() => undefined);
    this.databasePromise = null;
  }
}
