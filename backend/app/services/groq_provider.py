from groq import Groq
from app.services.llm_provider import LLMProvider
from app.core.config import settings

class GroqProvider(LLMProvider):

    def __init__(self):
        self.client = Groq(api_key=settings.GROQ_API_KEY)

    def generate(self, prompt: str) -> str:
        try:
            response = self.client.chat.completions.create(
                model="llama3-70b-8192",  # powerful free model
                messages=[
                    {"role": "system", "content": "You are a professional document analyst."},
                    {"role": "user", "content": prompt}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"AI Analysis Failed: {str(e)}"
