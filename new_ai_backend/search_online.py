from serpapi import GoogleSearch
import re
from typing import List
import os
from ollama_chat import chat_ollama

# Get SerpAPI key from environment variables
SERPAPI_KEY = os.environ.get("SERPAPI_KEY", "")

def get_search_query(search_query: str) -> str:
    """
    Generate a refined search query using OpenRouter.
    """
    system_prompt = """
    Generate a specific and informative search query for finding relevant images. Follow these guidelines:

    1. Focus on technical and professional aspects:
       - Include specific industry terms
       - Add relevant standards or regulations
       - Specify document types (charts, diagrams, infographics)
       - Include compliance-related terms

    2. Add context qualifiers:
       - "official" or "regulatory" for compliance documents
       - "technical" or "professional" for industry standards
       - "infographic" or "diagram" for visual explanations
       - "certification" or "compliance" for regulatory images

    3. Include specific elements:
       - Safety equipment or procedures
       - Compliance documentation
       - Regulatory symbols or logos
       - Technical specifications
       - Industry standards

    4. Avoid generic terms and focus on:
       - Specific compliance requirements
       - Technical documentation
       - Professional standards
       - Regulatory guidelines

    Examples:
    Query: "safety requirements for chemical storage"
    Response: "chemical storage safety compliance infographic OSHA regulations technical diagram"

    Query: "ISO 9001 implementation"
    Response: "ISO 9001 quality management system implementation flowchart certification process diagram"

    Query: "FDA medical device regulations"
    Response: "FDA medical device compliance requirements technical documentation regulatory guidelines infographic"

    Return ONLY the search phrase without any additional text or explanations.
    """

    try:
        response = chat_ollama(
            system_prompt, 
            f"Generate a specific image search query for: {search_query}", 
            model="llama3.2:latest"
        )
        return response.strip()
    except Exception as e:
        print(f"Error generating search query: {e}")
        # Enhanced fallback query
        fallback_terms = [
            "compliance",
            "regulatory",
            "technical",
            "professional",
            "infographic"
        ]
        return f"{search_query} {' '.join(fallback_terms[:2])}"

def search_images(search_query: str, max_images: int = 5) -> list:
    """
    Search for images using SerpAPI with optimized performance.
    Returns a list of image URLs.
    """
    try:
        # Skip query refinement to save time
        query = f"{search_query} compliance professional infographic"

        params = {
            "engine": "google_images",
            "q": query,
            "tbm": "isch",
            "num": max_images,
            "api_key": SERPAPI_KEY,
            "tbs": "isz:lt,islt:4mp",  # Filter for higher quality images
            "safe": "active"  # Safe search
        }

        from serpapi import GoogleSearch
        import requests
        from requests.exceptions import RequestException
        
        # Use requests directly with timeout
        try:
            response = requests.get(
                "https://serpapi.com/search",
                params=params,
                timeout=5  # 5 second timeout
            )
            
            if response.status_code != 200:
                print(f"SerpAPI error: Status code {response.status_code}")
                return []
                
            results = response.json()
            
        except RequestException:
            # Fallback to SerpAPI library if direct request fails
            search = GoogleSearch(params)
            results = search.get_dict()

        if "error" in results:
            print(f"SerpAPI error: {results['error']}")
            return []

        # Extract images quickly without complex filtering
        images = []
        for img in results.get("images_results", [])[:max_images]:
            if "original" in img:
                images.append(img.get("original"))

        return images

    except Exception as e:
        print(f"Error in search_images function for query '{search_query}': {str(e)}")
        return []
    
def search_videos(search_query: str, max_videos: int = 3) -> list:
    """
    Search for YouTube videos using SerpAPI with optimized performance.
    Returns a list of YouTube video IDs.
    """
    try:
        # Simplify query for speed
        query = f"{search_query} tutorial guide"

        params = {
            "engine": "youtube",
            "search_query": query,
            "api_key": SERPAPI_KEY,
            "num": max_videos
        }

        from serpapi import GoogleSearch
        import requests
        import re
        from requests.exceptions import RequestException
        
        # Use requests directly with timeout
        try:
            response = requests.get(
                "https://serpapi.com/search",
                params=params,
                timeout=5  # 5 second timeout
            )
            
            if response.status_code != 200:
                print(f"SerpAPI error: Status code {response.status_code}")
                return []
                
            results = response.json()
            
        except RequestException:
            # Fallback to SerpAPI library if direct request fails
            search = GoogleSearch(params)
            results = search.get_dict()

        if "error" in results:
            print(f"SerpAPI error: {results['error']}")
            return []

        # Extract video IDs directly
        video_links = [vid.get("link") for vid in results.get("video_results", [])[:max_videos] if "link" in vid]
        video_ids = [re.search(r"v=([\w-]+)", link).group(1) for link in video_links if re.search(r"v=([\w-]+)", link)]

        return video_ids

    except Exception as e:
        print(f"Error in search_videos function for query '{search_query}': {str(e)}")
        return []

def search_web_links(search_query: str, max_links: int = 5) -> list:
    """
    Search for web links using SerpAPI with optimized performance.
    Returns a list of extracted URLs.
    """
    try:
        params = {
            "engine": "google",
            "q": search_query,
            "api_key": SERPAPI_KEY,
            "num": max_links
        }

        from serpapi import GoogleSearch
        import requests
        from requests.exceptions import RequestException
        
        # Use requests directly with timeout
        try:
            response = requests.get(
                "https://serpapi.com/search",
                params=params,
                timeout=5  # 5 second timeout
            )
            
            if response.status_code != 200:
                print(f"SerpAPI error: Status code {response.status_code}")
                return []
                
            results = response.json()
            
        except RequestException:
            # Fallback to SerpAPI library if direct request fails
            search = GoogleSearch(params)
            results = search.get_dict()

        if "error" in results:
            print(f"SerpAPI error: {results['error']}")
            return []

        # Extract links quickly
        web_links = [result.get("link") for result in results.get("organic_results", [])[:max_links] if "link" in result]
        return web_links

    except Exception as e:
        print(f"Error in search_web_links function for query '{search_query}': {str(e)}")
        return []

def get_serpapi_links(query: str, num_results: int = 5) -> list:
    """Get relevant links using SerpAPI."""
    try:
        params = {
            "engine": "google",
            "q": f"{query} compliance regulations guidelines",
            "num": num_results,
            "api_key": SERPAPI_KEY
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        if "error" in results:
            print(f"SerpAPI error: {results['error']}")
            return []
            
        # Extract organic search results
        links = []
        for result in results.get("organic_results", [])[:num_results]:
            if "link" in result:
                links.append({
                    "url": result["link"],
                    "title": result.get("title", ""),
                    "snippet": result.get("snippet", "")
                })
        
        return links
    except Exception as e:
        print(f"Error in SerpAPI search: {e}")
        return []

def check_serpapi_availability() -> bool:
    """Check if SerpAPI is available and the API key is valid."""
    import requests
    from requests.exceptions import RequestException
    import time

    try:
        # Use a minimal query with very short timeout to quickly check availability
        start_time = time.time()
        
        # Use requests directly instead of SerpAPI library for better timeout control
        response = requests.get(
            "https://serpapi.com/search",
            params={
                "engine": "google",
                "q": "test",
                "num": 1,
                "api_key": "a6b3928073576a6c62c095966cc44e79a062a80c176bc12677bee97183af05fb",
                "output": "json",
                "source": "python"
            },
            timeout=3  # Very short timeout (3 seconds)
        )
        
        # Check if the response is valid
        if response.status_code == 200:
            elapsed = time.time() - start_time
            print(f"SerpAPI is available (response time: {elapsed:.2f}s)")
            return True
        else:
            print(f"SerpAPI returned error status code: {response.status_code}")
            return False
            
    except RequestException as e:
        print(f"SerpAPI availability check failed: {e}")
        return False
    except Exception as e:
        print(f"Unexpected error checking SerpAPI: {e}")
        return False