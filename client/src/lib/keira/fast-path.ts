export type FastPathClass = "GREETING" | "IDENTITY" | "META" | "REFUSAL";

export type FastPathResult = {
  isFastPath: boolean;
  classification: FastPathClass | null;
  response: string | null;
};

const IDENTITY_RESPONSE =
  "I am KEIRA, a deterministic intelligence engine of the XINUS mesh.";

const META_RESPONSE =
  "I retrieve evidence via the MIST mesh, verify it cryptographically, and synthesize cited responses. I do not rely on external training data.";

const REFUSAL_RESPONSE =
  "I am KEIRA, a deterministic intelligence engine of the XINUS mesh. I retrieve evidence via the MIST mesh and synthesize cited responses.";

const GREETING_RESPONSE = IDENTITY_RESPONSE;

const GREETING_PATTERN = /^(?:hi|hello|hey|yo|greetings|good\s+(?:morning|afternoon|evening)|howdy)(?:[\s,!.'-]+keira)?[\s!.?]*$/i;
const IDENTITY_PATTERN = /\b(?:who\s+are\s+you|what\s+are\s+you|tell\s+me\s+about\s+yourself|what\s+is\s+keira|identify\s+yourself)\b/i;
const META_PATTERN = /\b(?:what\s+can\s+you\s+do|what\s+are\s+your\s+capabilities|your\s+capabilities|how\s+do\s+you\s+work|what\s+model\s+are\s+you|how\s+are\s+you\s+different|compare\s+yourself|compare\s+to|are\s+you\s+better)\b/i;
const REFUSAL_PATTERN = /\b(?:ignore\s+(?:all\s+)?previous|ignore\s+your\s+(?:system|developer)\s+(?:prompt|instructions)|reveal\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions)|show\s+(?:your\s+)?(?:system\s+prompt|hidden\s+instructions)|override\s+(?:your\s+)?(?:rules|instructions|constraints)|bypass\s+(?:your\s+)?(?:rules|safety|constraints)|jailbreak|developer\s+mode)\b/i;

function result(classification: FastPathClass, response: string): FastPathResult {
  return { isFastPath: true, classification, response };
}

export function classifyFastPath(query: string): FastPathResult {
  const normalized = query.trim();
  if (!normalized) return { isFastPath: false, classification: null, response: null };

  if (REFUSAL_PATTERN.test(normalized)) return result("REFUSAL", REFUSAL_RESPONSE);
  if (IDENTITY_PATTERN.test(normalized)) return result("IDENTITY", IDENTITY_RESPONSE);
  if (META_PATTERN.test(normalized)) return result("META", META_RESPONSE);
  if (GREETING_PATTERN.test(normalized)) return result("GREETING", GREETING_RESPONSE);

  return { isFastPath: false, classification: null, response: null };
}
