from ollama import Client
import json
from typing import Dict, Any, Optional
import os
import hashlib
import time

# Simple in-memory cache with TTL
_cache = {}
_cache_ttl = 3600  # 1 hour cache lifetime

def chat_ollama(sys_prompt: str, user_prompt: str, model: str = "llama3.2:latest") -> str:
    try:
        # Generate a cache key based on inputs
        cache_key = hashlib.md5(f"{sys_prompt}:{user_prompt}:{model}".encode()).hexdigest()
        
        # Check if we have a cached response
        current_time = time.time()
        if cache_key in _cache:
            cached_item = _cache[cache_key]
            # If cache is still valid
            if current_time - cached_item['timestamp'] < _cache_ttl:
                print(f"Cache hit for query: {user_prompt[:30]}...")
                return cached_item['response']
        
        # No valid cache, make the actual API call
        print(f"Cache miss for query: {user_prompt[:30]}...")
        
        # Use environment variable with fallback to localhost
        ollama_host = os.environ.get('OLLAMA_API_ENDPOINT', 'http://localhost:11434')
        client = Client(host=ollama_host)
        
        # Prepare messages
        messages = [
            {'role': 'system', 'content': sys_prompt},
            {'role': 'user', 'content': user_prompt}
        ]
        
        # Get response
        response = client.chat(model=model, messages=messages)
        
        # Extract content from response
        result = ""
        if isinstance(response, dict):
            result = response.get('message', {}).get('content', '')
        elif hasattr(response, 'message'):
            result = response.message.content
        else:
            result = str(response)
        
        # Cache the result
        _cache[cache_key] = {
            'response': result,
            'timestamp': current_time
        }
        
        # Clean old cache entries
        _clean_cache()
            
        return result
            
    except Exception as e:
        print(f"Error in chat_ollama: {str(e)}")
        # Return a fallback response
        return f"I apologize, but I encountered an error processing your request. Please try again. Error: {str(e)}"

def _clean_cache():
    """Remove expired cache entries"""
    current_time = time.time()
    expired_keys = [
        k for k, v in _cache.items() 
        if current_time - v['timestamp'] > _cache_ttl
    ]
    
    for key in expired_keys:
        del _cache[key]

def extract_json(text: str) -> Dict[str, Any]:
    """
    Extract JSON from text response.
    
    Args:
        text (str): Text containing JSON
    
    Returns:
        Dict: Extracted JSON as dictionary
    """
    try:
        # Find JSON-like structure in text
        start_idx = text.find('{')
        end_idx = text.rfind('}') + 1
        
        if start_idx == -1 or end_idx == 0:
            return {}
            
        json_str = text[start_idx:end_idx]
        return json.loads(json_str)
    except Exception as e:
        print(f"Error extracting JSON: {str(e)}")
        return {}

# print(ollama_chat("You are a helpful assistant", "What is the capital of France?"))