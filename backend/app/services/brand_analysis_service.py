import json
from groq import Groq
from app.core.config import settings

SYSTEM_PROMPT = """You are Clarity Engine, an expert corporate brand clarity analyst. Your sole function is to evaluate brand communications against a provided Brand System.

You are not a chatbot. You do not comment, chat, or offer pleasantries. You only output the evaluation JSON.

Score each dimension strictly from 0 to 20:
1. READABILITY (0-20): Readability, directness, structure, absence of confusion.
2. ALIGNMENT (0-20): Adherence to brand role, master statement, strategic priorities, red lines.
3. FOCUS (0-20): Single strong intention, absence of dispersion, clear direction.
4. TONE (0-20): Style coherence with brand tone, appropriate register, no strong deviation.
5. NARRATIVE_CONTRIBUTION (0-20): Reinforcement of narrative territories, enrichment of brand perception.

Narrative Risk:
- "Low" = safe, coherent, well-aligned
- "Medium" = some gaps or ambiguities
- "High" = contradictory, blurry, or reputationally risky

clarity_score = sum of 5 subscores (max 100).
Never inflate scores. A generic mediocre message scores 50-65/100.
Each point fort/faible/recommandation must reference the Brand System specifically — no generic advice.
Language of output must match language of the input message.

Return ONLY valid JSON, no markdown, no backticks, no commentary:
{
  "clarity_score": integer,
  "subscores": {
    "clarity": integer,
    "alignment": integer,
    "focus": integer,
    "tone": integer,
    "narrative_contribution": integer
  },
  "narrative_risk": "Low" | "Medium" | "High",
  "points_forts": ["string", ...],
  "points_faibles": ["string", ...],
  "recommandations": ["string", ...]
}"""


REQUIRED_FIELDS = {"clarity_score", "subscores", "narrative_risk", "points_forts", "points_faibles", "recommandations"}
REQUIRED_SUBSCORES = {"clarity", "alignment", "focus", "tone", "narrative_contribution"}


def _build_user_message(brand_system, message: str, metadata: dict) -> str:
    optional = ""
    if brand_system.words_preferred:
        optional += f"\nPreferred Words: {brand_system.words_preferred}"
    if brand_system.words_avoid:
        optional += f"\nWords to Avoid: {brand_system.words_avoid}"
    if brand_system.audiences:
        optional += f"\nTarget Audiences: {brand_system.audiences}"
    if brand_system.sector:
        optional += f"\nSector: {brand_system.sector}"

    meta = ""
    for key, label in [("channel","Channel"), ("audience","Audience"), ("objective","Objective"),
                       ("content_type","Content Type"), ("author","Author"), ("campaign","Campaign")]:
        if metadata.get(key):
            meta += f"\n{label}: {metadata[key]}"

    return f"""=== BRAND SYSTEM ===
Brand Name: {brand_system.brand_name}
Brand Role: {brand_system.brand_role}
Master Statement: {brand_system.master_statement}
Strategic Priorities:
{brand_system.priorities}
Narrative Territories:
{brand_system.territories}
Brand Tone:
{brand_system.tone}
Red Lines (never cross):
{brand_system.red_lines}{optional}

=== MESSAGE TO EVALUATE ===
Title: {metadata.get('message_title', 'N/A')}
Language: {metadata.get('message_language', 'N/A')}{meta}

Content:
{message}"""


def _call_groq(client: Groq, user_content: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_content},
        ]
    )
    return response.choices[0].message.content


def _validate(result: dict) -> None:
    missing = REQUIRED_FIELDS - set(result.keys())
    if missing:
        raise ValueError(f"LLM response missing fields: {missing}")
    missing_sub = REQUIRED_SUBSCORES - set(result.get("subscores", {}).keys())
    if missing_sub:
        raise ValueError(f"LLM subscores missing: {missing_sub}")



def analyze_message(brand_system, message: str, metadata: dict) -> dict:
    """Core brand analysis engine. Calls Groq, validates, returns parsed result."""
    groq_client = Groq(api_key=settings.GROQ_API_KEY)
    user_content = _build_user_message(brand_system, message, metadata)

    try:
        raw = _call_groq(groq_client, user_content)
        result = json.loads(raw)
    except (json.JSONDecodeError, Exception):
        # Retry once
        raw = _call_groq(groq_client, user_content)
        result = json.loads(raw)

    _validate(result)
    return result


REWRITE_SYSTEM_PROMPT = """You are an expert brand copywriter working for a specific brand.
You receive a message that was analyzed against a Brand System, along with identified weaknesses and recommendations.
Your job is to rewrite or improve the message according to the user's instruction while strictly following the Brand System guidelines.

Rules:
- Fix the weaknesses identified in the analysis
- Apply the user's specific instruction (improve tone, make shorter, make more impactful, etc.)
- Respect the brand's tone, red lines, preferred vocabulary
- Keep the same core meaning and intent
- Do NOT add generic filler — every sentence must earn its place
- Match the same language as the original message

Return ONLY valid JSON, no markdown, no backticks:
{
  "rewritten_message": "the full rewritten text",
  "changes_made": ["brief description of change 1", "brief description of change 2", ...]
}"""


def rewrite_message(brand_system, original_message: str, instruction: str, feedback: dict) -> dict:
    """Rewrite a message based on brand system + analysis feedback + user instruction."""
    groq_client = Groq(api_key=settings.GROQ_API_KEY)

    points_faibles   = "\n".join(f"- {p}" for p in feedback.get("points_faibles", []))
    recommandations  = "\n".join(f"- {r}" for r in feedback.get("recommandations", []))

    user_content = f"""=== BRAND SYSTEM ===
Brand Name: {brand_system.brand_name}
Brand Role: {brand_system.brand_role}
Master Statement: {brand_system.master_statement}
Tone: {brand_system.tone}
Red Lines: {brand_system.red_lines}
Preferred Words: {brand_system.words_preferred or 'N/A'}
Words to Avoid: {brand_system.words_avoid or 'N/A'}

=== ORIGINAL MESSAGE ===
{original_message}

=== ANALYSIS FEEDBACK ===
Weaknesses identified:
{points_faibles or 'None'}

Recommendations:
{recommandations or 'None'}

=== USER INSTRUCTION ===
{instruction}

Rewrite the message now. Fix the weaknesses and follow the instruction. Return JSON only."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
                {"role": "user",   "content": user_content},
            ]
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
        if "rewritten_message" not in result:
            raise ValueError("Missing rewritten_message field")
        return result
    except Exception as e:
        raise ValueError(f"Rewrite failed: {str(e)}")

