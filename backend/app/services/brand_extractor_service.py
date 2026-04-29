"""
Brand field extractor from raw document text.
Uses Groq to intelligently parse brand identity information from unstructured content.
"""
import json
from groq import Groq
from app.core.config import settings

BRAND_FIELDS = [
    "brand_name", "brand_role", "master_statement",
    "priorities", "territories", "tone", "red_lines",
    "words_preferred", "words_avoid", "audiences", "sector",
]

EXTRACTION_SYSTEM_PROMPT = """You are an expert brand strategist and analyst.
You receive raw text extracted from brand identity documents (brand books, brand platforms, positioning guides, verbal identity guides, etc.).

Your job is to extract ALL brand information and structure it into specific fields.

EXTRACTION RULES:
1. Be EXHAUSTIVE — do not summarize or shorten. Use the exact words, formulations, lists and sentences from the documents.
2. For lists (priorities, territories, audiences, vocabulary) → format as numbered or bullet lists preserving ALL items.
3. For multi-paragraph fields (brand_role, tone) → preserve the full paragraphs.
4. red_lines = things the brand must NEVER say, do, or be confused with.
5. words_preferred = exact vocabulary words/expressions to use.
6. words_avoid = exact words/expressions to avoid.
7. master_statement = the brand's tagline, signature, or positioning statement.
8. If a field is genuinely not found in the documents → return exactly: "Non spécifié dans les documents fournis."
9. NEVER invent or hallucinate. Only extract what is explicitly written.

Return ONLY valid JSON with exactly these 11 keys:
{
  "brand_name": "...",
  "brand_role": "...",
  "master_statement": "...",
  "priorities": "...",
  "territories": "...",
  "tone": "...",
  "red_lines": "...",
  "words_preferred": "...",
  "words_avoid": "...",
  "audiences": "...",
  "sector": "..."
}"""


def extract_brand_fields(combined_text: str) -> dict:
    """
    Call Groq to extract structured brand fields from raw document text.
    Returns a dict with all brand fields.
    """
    groq_client = Groq(api_key=settings.GROQ_API_KEY)

    # Groq llama-3.3-70b-versatile has 128K context. We send up to 80K chars (~20K tokens).
    # This ensures virtually no truncation for standard brand documents.
    MAX_CHARS = 80_000
    if len(combined_text) > MAX_CHARS:
        # Keep the beginning AND the end (intros + conclusions are most info-dense)
        half = MAX_CHARS // 2
        combined_text = (
            combined_text[:half]
            + "\n\n[... middle section truncated for length ...]\n\n"
            + combined_text[-half:]
        )

    user_content = f"=== BRAND DOCUMENTS ===\n\n{combined_text}"

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.05,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": EXTRACTION_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ],
            max_tokens=4096,
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)

        # Ensure all keys exist
        for field in BRAND_FIELDS:
            if field not in result:
                result[field] = ""

        return result

    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}")
    except Exception as e:
        raise ValueError(f"Brand extraction failed: {e}")
