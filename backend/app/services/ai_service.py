import json
from app.services.groq_provider import GroqProvider

class AIService:

    def __init__(self):
        self.llm = GroqProvider()

    def summarize_text(self, text: str):

        prompt = f"""
Return ONLY valid JSON with this exact format:

{{
  "summary": "short summary",
  "entities": ["entity1", "entity2"],
  "risks": ["risk1"],
  "decisions": ["decision1"]
}}

Analyze this document:

{text}
"""

        result = self.llm.generate(prompt)

        # Clean markdown code blocks if the LLM adds them
        if result.startswith("```json"):
            result = result[7:]
        if result.endswith("```"):
            result = result[:-3]
        result = result.strip()

        try:
            return json.loads(result)
        except json.JSONDecodeError:
            print("Failed to parse JSON. Raw result:", result)
            return {"summary": "Error parsing JSON", "entities": [], "risks": [], "decisions": []}
