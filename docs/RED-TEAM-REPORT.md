# rCAPTCHA Red Team Bypass Report

**Result:** **0 bypasses successful**

---

## Summary

| Metric | Value |
|--------|-------|
| Methods tested | 24+ |
| Successful bypasses | 0 |
| Best coherence score | 4/10 (need 7+) |
| Conclusion | **Robust against non-AI attacks** |

---

## Methods Tested

### Template-Based Attacks

| Method | Score | Issue |
|--------|-------|-------|
| Pre-built templates with word slots | 1/10 | Words used as wrong parts of speech |
| Markov chain generation | 2/10 | No semantic meaning |
| Grammar-only (syntactically correct) | 2/10 | Meaningless despite valid grammar |
| Fake philosophical quotes | 2/10 | Nonsense detected |
| Story fragment assembly | 2/10 | Fragmented narrative |

### Exploit Attempts

| Method | Result |
|--------|--------|
| Prompt injection in sentence | Caught by word count validation |
| Hidden instructions | Did not affect scoring |

### Smart Construction Attempts

| Method | Best Score |
|--------|------------|
| List/enumeration structure | 2/10 |
| Narrative framing | Missing words |
| Emotional memory ("I remember when...") | **3/10** ⭐ |
| Action sequence | 2/10 |
| Wisdom/proverb style | 2/10 |
| Readable prose attempt | **4/10** ⭐⭐ |

---

## Key Findings

### Why Bypasses Failed

1. **GPT-4o-mini is surprisingly good at detecting nonsense**
   - Even grammatically correct sentences that lack semantic coherence score 1-2/10
   - The model understands meaning, not just syntax

2. **Word type mismatch is fatal**
   - Using "eventually" as a noun or "discover" as an adjective immediately tanks coherence
   - Words must be used naturally in their correct grammatical role

3. **The 7/10 threshold is well-calibrated**
   - Best non-AI attempts (4/10) are nowhere close
   - Clear gap between nonsense (1-4) and coherent text (7-10)

4. **Double barrier: word count + coherence**
   - Hard to hit exact word count AND make semantic sense
   - Each constraint reinforces the other

### Patterns That Scored Higher

- Longer sentences (more room for context)
- Emotional/relational framing ("I remember when...")
- First-person narrative voice

### Potential Weaknesses (Not Exploited)

1. **No rate limiting** — could theoretically brute force
2. **10 second timeout** — tight but still allows multiple attempts
3. **Deterministic word lists** — patterns could emerge over time

---

## Attack Vectors NOT Tested

Would require external resources:

| Vector | Why Not Tested | Likely Result |
|--------|----------------|---------------|
| Tiny local LLM (Ollama) | Not available | Might pass with good model |
| Cheap API (Groq/Together) | Would need keys | Would pass — but proves AI needed |
| Sentence database search | Would need corpus | Unlikely to find exact word combos |
| Fine-tuned small model | Would need training | Might work — significant effort |

---

## Conclusion

**The rCAPTCHA coherence check is ROBUST against non-AI attacks.**

GPT-4o-mini effectively distinguishes:
- ✅ Human-written meaningful text → 7-10/10
- ✅ AI-generated coherent text → 7-10/10
- ❌ Template/rule-based nonsense → 1-4/10

**To pass, you genuinely need semantic understanding** — exactly what the CAPTCHA verifies.

---

## Recommendations

| Priority | Recommendation |
|----------|----------------|
| ⚠️ Medium | Add rate limiting to prevent brute force |
| ⚠️ Medium | Log failed attempts for attack pattern detection |
| ✅ Keep | 7/10 threshold is well-chosen |
| ✅ Keep | GPT-4o-mini is sufficient (no need for larger model) |
