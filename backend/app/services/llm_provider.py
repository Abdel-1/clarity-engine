from abc import ABC, abstractmethod

# This is an interface (contract for all LLMs)
class LLMProvider(ABC):

    @abstractmethod
    def generate(self, prompt: str) -> str:
        pass
