from app.services.groq_provider import GroqProvider

class AIService:

    def __init__(self):
        # Now AI is independent of provider
        self.llm = GroqProvider()

    def summarize_text(self, text: str):

        prompt = f"""
        Analyze this document and return:

        1. Summary
        2. Key points
        3. Entities (people, concepts, places)
        4. Risks / decisions

        Document:
        {text}
        """

        return self.llm.generate(prompt)
