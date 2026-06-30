from abc import ABC, abstractmethod


class BaseAgent(ABC):
    """Base class for all AI agents."""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
    
    @abstractmethod
    async def process(self, data: dict) -> dict:
        """Process input data and return results."""
        pass
    
    def format_response(self, success: bool, data: dict = None, message: str = ""):
        return {
            "agent": self.name,
            "success": success,
            "data": data or {},
            "message": message
        }
