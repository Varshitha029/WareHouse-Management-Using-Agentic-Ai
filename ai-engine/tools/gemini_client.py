from google import genai
from config.settings import GEMINI_API_KEY, GEMINI_MODEL, TEMPERATURE_CREATIVE, TEMPERATURE_ANALYTICAL
import json
import re
import asyncio

client = genai.Client(api_key=GEMINI_API_KEY)

# Fallback model chain: try primary model first, then alternatives
FALLBACK_MODELS = [
    GEMINI_MODEL,          # gemma-3-27b-it (configured - working)
    'gemma-3-4b-it',
    'gemma-3-1b-it',
    'gemini-2.0-flash',    # currently rate-limited, keep as fallback
    'gemini-2.0-flash-lite',
]

class GeminiClient:
    
    @classmethod
    async def _call_with_retry(cls, contents, config, max_retries=2):
        """Try generating content with fallback models and retries."""
        last_error = None
        for model in FALLBACK_MODELS:
            for attempt in range(max_retries):
                try:
                    response = await client.aio.models.generate_content(
                        model=model,
                        contents=contents,
                        config=config
                    )
                    if response and response.text:
                        return response.text
                except Exception as e:
                    last_error = e
                    err_str = str(e)
                    # If quota exhausted or rate limited, try next model immediately
                    if '429' in err_str or 'RESOURCE_EXHAUSTED' in err_str:
                        print(f"Model {model} quota exhausted, trying next model...")
                        break
                    # If model not found, skip to next
                    if '404' in err_str or 'NOT_FOUND' in err_str:
                        print(f"Model {model} not available, trying next model...")
                        break
                    # If API key invalid, no point retrying
                    if '400' in err_str and 'API_KEY' in err_str:
                        raise e
                    # For other errors, wait and retry
                    if attempt < max_retries - 1:
                        await asyncio.sleep(1 * (attempt + 1))
                    print(f"Model {model} attempt {attempt+1} error: {str(e)[:100]}")
        
        raise last_error or Exception("All models failed")
    
    @classmethod
    async def generate_text(cls, prompt, system_prompt=None, creative=False):
        """Generate text response from Gemini."""
        try:
            temperature = TEMPERATURE_CREATIVE if creative else TEMPERATURE_ANALYTICAL
            
            full_prompt = ""
            if system_prompt:
                full_prompt = f"System Instructions:\n{system_prompt}\n\n"
            full_prompt += f"User Query:\n{prompt}"
            
            config = genai.types.GenerateContentConfig(
                temperature=temperature,
                max_output_tokens=8192
            )
            
            return await cls._call_with_retry(full_prompt, config)
        except Exception as e:
            print(f"Gemini API error: {e}")
            return f"AI service temporarily unavailable: {str(e)}"
    
    @classmethod
    async def generate_json(cls, prompt, system_prompt=None, creative=False):
        """Generate and parse JSON response from Gemini."""
        try:
            system_with_json = (system_prompt or "") + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code blocks, no explanation."
            
            text = await cls.generate_text(prompt, system_with_json, creative)
            
            # Try to extract JSON from response
            text = text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith('```'):
                text = re.sub(r'^```(?:json)?\s*\n?', '', text)
                text = re.sub(r'\n?```\s*$', '', text)
            
            return json.loads(text)
        except json.JSONDecodeError:
            # Try to find JSON in the text
            json_match = re.search(r'\{[\s\S]*\}|\[[\s\S]*\]', text)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            return {"error": "Failed to parse AI response as JSON", "raw": text}
        except Exception as e:
            return {"error": str(e)}
    
    @classmethod
    async def chat(cls, messages, system_prompt=None):
        """Handle multi-turn chat conversation."""
        try:
            # Build conversation context
            context = ""
            if system_prompt:
                context = f"System Instructions:\n{system_prompt}\n\n"
            
            context += "Conversation History:\n"
            for msg in messages[:-1]:
                role = "User" if msg.get('role') == 'user' else "Assistant"
                context += f"{role}: {msg.get('content', '')}\n"
            
            last_message = messages[-1].get('content', '') if messages else ''
            context += f"\nUser: {last_message}\n\nAssistant:"
            
            config = genai.types.GenerateContentConfig(
                temperature=TEMPERATURE_CREATIVE,
                max_output_tokens=8192
            )
            
            return await cls._call_with_retry(context, config)
        except Exception as e:
            print(f"Gemini chat error: {e}")
            return f"I'm having trouble connecting. Please try again later."
