import { createHash } from 'crypto';
import { z } from 'zod';
import { RecommendationEvidence } from './tools';

// Provider adapters translate this small contract to OpenAI, Anthropic, Bedrock,
// or a local model. Provider-specific messages, SDK objects and hidden reasoning
// never become domain records. No adapter or network client is installed here.
export interface ExplanationProvider {
  readonly id: string;
  explain(input: { question: string; evidence: RecommendationEvidence; signal: AbortSignal }): Promise<unknown>;
}
export interface EvidenceExplanation { source: 'evidence' | 'model'; summary: string; evidenceIds: string[]; limitations: string[] }
const output = z.object({ summary: z.string().trim().min(1).max(2000), evidenceIds: z.array(z.string().max(200)).min(1).max(18), limitations: z.array(z.string().max(500)).max(8) }).strict();
const fingerprint = ({ generatedAt: _at, ...evidence }: RecommendationEvidence) => createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
function fallback(evidence: RecommendationEvidence): EvidenceExplanation {
  const film = evidence.films[0], source = film?.sources[0];
  return { source: 'evidence', summary: source ? `${film.title} connects through @${source.username} after ${source.sharedFilmTitle}. Open their responses to see what they recorded.` : 'There is not enough shared-response evidence to explain a personal recommendation yet.',
    evidenceIds: source ? [source.evidenceId] : [], limitations: evidence.limitations };
}

export async function explainRecommendation(input: {
  question: string;
  // Reloads with the authenticated viewer's visibility, never from model input.
  loadEvidence: () => Promise<RecommendationEvidence>;
  provider?: ExplanationProvider;
  allowExternalInference?: boolean;
  signal?: AbortSignal;
}): Promise<EvidenceExplanation> {
  const question = z.string().trim().min(1).max(1000).parse(input.question);
  input.signal?.throwIfAborted();
  const evidence = await input.loadEvidence();
  if (!input.provider || !input.allowExternalInference || !evidence.films.length) return fallback(evidence);
  const controller = new AbortController();
  const abort = () => controller.abort(input.signal?.reason);
  input.signal?.addEventListener('abort', abort, { once: true });
  if (input.signal?.aborted) abort();
  const timer = setTimeout(() => controller.abort(new Error('Explanation timed out.')), 8000);
  let stop: (() => void) | undefined;
  try {
    // A provider may ignore cancellation. The caller still returns within budget.
    const cancelled = new Promise<never>((_resolve, reject) => {
      stop = () => reject(controller.signal.reason ?? new Error('Cancelled'));
      controller.signal.addEventListener('abort', stop, { once: true });
      if (controller.signal.aborted) stop();
    });
    const proposed = await Promise.race([input.provider.explain({ question, evidence, signal: controller.signal }), cancelled]);
    input.signal?.throwIfAborted();
    const current = await input.loadEvidence();
    if (fingerprint(current) !== fingerprint(evidence)) return fallback(current);
    const parsed = output.safeParse(proposed);
    const known = new Set(current.films.flatMap(film => film.sources.map(source => source.evidenceId)));
    if (!parsed.success || parsed.data.evidenceIds.some(id => !known.has(id))) return fallback(current);
    return { source: 'model', ...parsed.data, evidenceIds: [...new Set(parsed.data.evidenceIds)], limitations: [...new Set([...current.limitations, ...parsed.data.limitations])] };
  } catch {
    input.signal?.throwIfAborted();
    // Revalidate even after timeout: a block or source removal may have occurred.
    return fallback(await input.loadEvidence());
  } finally {
    clearTimeout(timer); input.signal?.removeEventListener('abort', abort);
    if (stop) controller.signal.removeEventListener('abort', stop);
  }
}
