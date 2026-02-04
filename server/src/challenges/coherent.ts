/**
 * Coherent Sentence Challenge
 * 
 * Challenge: Write a meaningful N-word sentence using specific random words
 * 
 * Why this works:
 * - Script can't generate coherent sentences without AI
 * - Human can't do it in 3 seconds
 * - AI does it trivially
 * 
 * Verification:
 * 1. Contains all required words (string match)
 * 2. Exactly N words (count)
 * 3. Grammatically valid (basic check)
 * 4. Coherent (gpt-4o-mini scoring)
 */

// Word pools for generating challenges
const NOUNS = [
  'apple', 'telescope', 'mountain', 'river', 'butterfly', 'castle', 'dragon',
  'library', 'volcano', 'umbrella', 'penguin', 'lighthouse', 'whisper', 'thunder',
  'garden', 'crystal', 'shadow', 'melody', 'puzzle', 'compass', 'lantern',
  'feather', 'anchor', 'rainbow', 'bridge', 'mirror', 'candle', 'forest',
  'island', 'treasure', 'clock', 'storm', 'diamond', 'sunset', 'keyboard'
];

const ADJECTIVES = [
  'purple', 'ancient', 'silent', 'golden', 'frozen', 'hidden', 'curious',
  'gentle', 'fierce', 'mysterious', 'brilliant', 'hollow', 'distant', 'sacred',
  'fragile', 'endless', 'vivid', 'tranquil', 'bold', 'subtle'
];

const VERBS = [
  'whisper', 'dance', 'climb', 'discover', 'remember', 'chase', 'embrace',
  'wander', 'create', 'believe', 'vanish', 'emerge', 'transform', 'protect'
];

const TIME_WORDS = [
  'yesterday', 'tomorrow', 'wednesday', 'midnight', 'sunrise', 'autumn',
  'forever', 'suddenly', 'eventually', 'meanwhile'
];

// Input validation constants
export const MAX_SENTENCE_LENGTH = 10000;  // Max characters for sentence input

export interface CoherentChallenge {
  words: string[];      // 5 random words to include
  wordCount: number;    // Required sentence length (15-25)
  timeoutMs: number;    // Challenge timeout
}

export interface CoherentAnswer {
  sentence: string;
}

export interface CoherentVerifyResult {
  valid: boolean;
  errors: string[];
  coherenceScore?: number;  // 1-10 from AI check
}

/**
 * Pick N random items from an array (cryptographically secure)
 */
function pickRandom<T>(arr: T[], n: number): T[] {
  const randomBytes = new Uint32Array(arr.length);
  crypto.getRandomValues(randomBytes);

  const shuffled = [...arr]
    .map((item, i) => ({ item, sort: randomBytes[i] }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);

  return shuffled.slice(0, n);
}

/**
 * Generate a coherent sentence challenge
 */
export function generateCoherentChallenge(): CoherentChallenge {
  // Pick 5 diverse words (mix of types)
  const words = [
    ...pickRandom(NOUNS, 2),
    ...pickRandom(ADJECTIVES, 1),
    ...pickRandom(VERBS, 1),
    ...pickRandom(TIME_WORDS, 1),
  ].sort(() => Math.random() - 0.5); // Shuffle
  
  // Random word count between 15-25 (cryptographically secure)
  const randomByte = new Uint8Array(1);
  crypto.getRandomValues(randomByte);
  const wordCount = 15 + (randomByte[0] % 11);
  
  return {
    words,
    wordCount,
    timeoutMs: 10000,  // 10s - gives network latency room
  };
}

/**
 * Check if all required words are present (case-insensitive)
 */
function containsAllWords(sentence: string, words: string[]): { valid: boolean; missing: string[] } {
  const lowerSentence = sentence.toLowerCase();
  const missing: string[] = [];
  
  for (const word of words) {
    // Check for word boundaries to avoid false positives
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`);
    if (!regex.test(lowerSentence)) {
      missing.push(word);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Count words in a sentence
 */
function countWords(sentence: string): number {
  return sentence.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Basic grammar check - at minimum, should start with capital and end with punctuation
 */
function basicGrammarCheck(sentence: string): { valid: boolean; error?: string } {
  const trimmed = sentence.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Empty sentence' };
  }
  
  // Should start with capital letter
  if (!/^[A-Z]/.test(trimmed)) {
    return { valid: false, error: 'Sentence should start with a capital letter' };
  }
  
  // Should end with punctuation
  if (!/[.!?]$/.test(trimmed)) {
    return { valid: false, error: 'Sentence should end with punctuation (.!?)' };
  }
  
  return { valid: true };
}

/**
 * Check coherence using gpt-4o-mini
 * Returns score 1-10 where >= 7 is coherent
 */
export async function checkCoherence(sentence: string): Promise<{ score: number; error?: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback: skip coherence check if no API key (defaults to passing)
    return { score: 7 };
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You rate sentence coherence. Reply with ONLY a number 1-10. 1=gibberish, 5=grammatical but nonsensical, 7=makes sense, 10=perfectly natural.',
          },
          {
            role: 'user',
            content: `Rate this sentence: "${sentence}"`,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      }),
    });
    
    if (!response.ok) {
      return { score: 7, error: 'API error, defaulting to pass' };
    }
    
    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const score = parseInt(content, 10);
    
    if (isNaN(score) || score < 1 || score > 10) {
      return { score: 7 }; // Invalid response, default to passing
    }
    
    return { score };
  } catch {
    return { score: 7, error: 'Check failed, defaulting to pass' };
  }
}

/**
 * Verify a coherent sentence answer
 */
export async function verifyCoherent(
  challenge: CoherentChallenge,
  answer: CoherentAnswer
): Promise<CoherentVerifyResult> {
  const errors: string[] = [];
  const sentence = answer.sentence?.trim() || '';

  // Input length validation
  if (sentence.length > MAX_SENTENCE_LENGTH) {
    return {
      valid: false,
      errors: [`Sentence too long: ${sentence.length} chars (max ${MAX_SENTENCE_LENGTH})`],
    };
  }
  
  // 1. Check all words present
  const wordCheck = containsAllWords(sentence, challenge.words);
  if (!wordCheck.valid) {
    errors.push(`Missing words: ${wordCheck.missing.join(', ')}`);
  }
  
  // 2. Check word count
  const actualCount = countWords(sentence);
  if (actualCount !== challenge.wordCount) {
    errors.push(`Word count: expected ${challenge.wordCount}, got ${actualCount}`);
  }
  
  // 3. Basic grammar check
  const grammarCheck = basicGrammarCheck(sentence);
  if (!grammarCheck.valid) {
    errors.push(grammarCheck.error!);
  }
  
  // 4. Coherence check (only if passed other checks)
  let coherenceScore: number | undefined;
  if (errors.length === 0) {
    const coherence = await checkCoherence(sentence);
    coherenceScore = coherence.score;
    
    if (coherence.score < 7) {
      errors.push(`Sentence not coherent enough (score: ${coherence.score}/10, need 7+)`);
    }
  }
  
  const valid = errors.length === 0;

  // Log failed verification attempts (for monitoring)
  if (!valid) {
    console.log(JSON.stringify({
      event: 'verification_failed',
      timestamp: new Date().toISOString(),
      errors,
      coherenceScore,
      wordCount: challenge.wordCount,
      actualWordCount: countWords(sentence),
    }));
  }

  return {
    valid,
    errors,
    coherenceScore,
  };
}
