/**
 * Server-side embedding provider for MIST.
 * Connects to the local Ollama instance on SFO2.
 */

export class EmbeddingProviderError extends Error {
  readonly code: string;
  constructor(message: string, code = 'EMBEDDING_PROVIDER_ERROR') {
    super(message);
    this.name = 'EmbeddingProviderError';
    this.code = code;
  }
}

const DEFAULT_ENDPOINT = process.env.OLLAMA_EMBED_ENDPOINT || 'http://10.9.0.1:11434/api/embeddings';
const DEFAULT_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new EmbeddingProviderError('Embedding input cannot be empty', 'EMPTY_INPUT');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(DEFAULT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: DEFAULT_MODEL, prompt: text }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EmbeddingProviderError(
        `Ollama embedding failed: ${response.status} ${errorText}`,
        'OLLAMA_HTTP_ERROR'
      );
    }

    const data = await response.json();
    
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new EmbeddingProviderError(
        'Ollama returned an invalid embedding format',
        'INVALID_RESPONSE_FORMAT'
      );
    }

    return data.embedding;
  } catch (error: unknown) {
    if (error instanceof EmbeddingProviderError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new EmbeddingProviderError(`Embedding request failed: ${msg}`, 'REQUEST_FAILED');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await generateEmbedding(text));
  }
  return results;
}
