from typing import Tuple, List, Dict, Any
from bs4 import BeautifulSoup
import asyncio
import aiohttp
import time
import hashlib
import re
from urllib.parse import urlparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import os
import traceback

# Simple in-memory cache for web scraping results
_scrape_cache = {}
_cache_ttl = 172800  # 48 hours cache lifetime (doubled from 24h)

# Create a persistent session for connection pooling
_session = None

# Semaphore to limit concurrent requests
_request_semaphore = None
MAX_CONCURRENT_REQUESTS = 3  # Reduced from 5 to 3 for better stability

# Maximum content length to download (3MB)
MAX_CONTENT_LENGTH = 3 * 1024 * 1024

# Blacklisted domains that should be skipped
BLACKLISTED_DOMAINS = [
    'facebook.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com',
    'youtube.com'
]

# Create a simple cache directory if it doesn't exist
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Cache expiration time (24 hours)
CACHE_EXPIRATION = 86400

def get_session():
    """Get or create a persistent aiohttp session"""
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=3),  # Reduced timeout to 3 seconds
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
            }
        )
    return _session

def get_semaphore():
    """Get or create request semaphore"""
    global _request_semaphore
    if _request_semaphore is None:
        _request_semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    return _request_semaphore

async def close_session():
    """Close the persistent session"""
    global _session
    if _session and not _session.closed:
        await _session.close()
        _session = None

def get_cache_path(url):
    """Generate a cache file path for a URL."""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    return os.path.join(CACHE_DIR, f"{url_hash}.txt")

def get_from_cache(url):
    """Try to get content from cache."""
    cache_path = get_cache_path(url)
    if os.path.exists(cache_path):
        # Check if cache is still valid
        if time.time() - os.path.getmtime(cache_path) < CACHE_EXPIRATION:
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    return f.read()
            except:
                pass
    return None

def save_to_cache(url, content):
    """Save content to cache."""
    try:
        cache_path = get_cache_path(url)
        with open(cache_path, 'w', encoding='utf-8') as f:
            f.write(content)
    except:
        pass

def scrape_url(url, timeout=3, max_content_length=100000):
    """
    Scrape content from a URL with optimized performance.
    
    Args:
        url: The URL to scrape
        timeout: Connection timeout in seconds (default: 3)
        max_content_length: Maximum content length to process (default: 100KB)
        
    Returns:
        Extracted text content
    """
    # Skip blacklisted domains
    domain = urlparse(url).netloc
    if any(blacklisted in domain for blacklisted in BLACKLISTED_DOMAINS):
        print(f"Skipping blacklisted domain: {domain}")
        return ""
    
    # Check cache first
    cached_content = get_from_cache(url)
    if cached_content:
        print(f"Using cached content for {url}")
        return cached_content
    
    try:
        # Parse domain to set appropriate headers
        domain = urlparse(url).netloc
        
        # Use a common user agent to avoid blocks
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": f"https://www.google.com/search?q={domain}",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1"
        }
        
        start_time = time.time()
        
        # Stream the response to check content length before downloading everything
        with requests.get(url, headers=headers, timeout=timeout, stream=True) as response:
            # Check if the response is HTML
            content_type = response.headers.get('Content-Type', '')
            if not ('text/html' in content_type or 'application/xhtml+xml' in content_type):
                print(f"Skipping non-HTML content: {content_type} for {url}")
                return ""
                
            # Check content length if available
            content_length = response.headers.get('Content-Length')
            if content_length and int(content_length) > max_content_length:
                print(f"Content too large ({content_length} bytes) for {url}")
                return ""
                
            # Read content with size limit
            content = b""
            for chunk in response.iter_content(chunk_size=10240):  # 10KB chunks
                content += chunk
                if len(content) > max_content_length:
                    print(f"Reached content size limit for {url}")
                    break
                    
                # Check if we're taking too long
                if time.time() - start_time > timeout * 2:
                    print(f"Taking too long to download {url}")
                    break
            
            # Parse HTML
            soup = BeautifulSoup(content, 'html.parser')
            
            # Remove script, style, and other non-content elements
            for element in soup(['script', 'style', 'header', 'footer', 'nav', 'aside', 'noscript', 'iframe']):
                element.decompose()
                
            # Extract text
            text = soup.get_text(separator='\n', strip=True)
            
            # Clean up text
            text = re.sub(r'\n+', '\n', text)  # Remove multiple newlines
            text = re.sub(r'\s+', ' ', text)   # Normalize whitespace
            
            # Truncate to reasonable length
            text = text[:10000]  # Limit to 10K characters
            
            # Save to cache
            save_to_cache(url, text)
            
            return text
            
    except requests.exceptions.RequestException as e:
        print(f"Request error for {url}: {e}")
        return ""
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return ""

def _is_blacklisted_domain(url: str) -> bool:
    """Check if URL is from a blacklisted domain"""
    parsed = urlparse(url)
    domain = parsed.netloc.lower()
    
    return any(bd in domain for bd in BLACKLISTED_DOMAINS)

def _is_html_url(url: str) -> bool:
    """Check if URL is likely to be an HTML page"""
    parsed = urlparse(url)
    path = parsed.path.lower()
    
    # Skip common non-HTML files
    if path.endswith(('.pdf', '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.zip', '.doc', '.docx', '.xlsx', '.pptx', '.csv')):
        return False
    
    return True

def _extract_main_content(html: str, max_length: int = 50000) -> str:
    """Extract main content from HTML using regex patterns for speed"""
    try:
        # Remove scripts, styles, and comments
        html = re.sub(r'<script.*?</script>', ' ', html, flags=re.DOTALL)
        html = re.sub(r'<style.*?</style>', ' ', html, flags=re.DOTALL)
        html = re.sub(r'<!--.*?-->', ' ', html, flags=re.DOTALL)
        
        # Remove header, footer, nav
        html = re.sub(r'<header.*?</header>', ' ', html, flags=re.DOTALL)
        html = re.sub(r'<footer.*?</footer>', ' ', html, flags=re.DOTALL)
        html = re.sub(r'<nav.*?</nav>', ' ', html, flags=re.DOTALL)
        
        # Extract text from paragraphs, headings, and list items
        text_parts = []
        for tag in ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']:
            pattern = f'<{tag}[^>]*>(.*?)</{tag}>'
            matches = re.findall(pattern, html, re.DOTALL)
            text_parts.extend(matches)
        
        # Clean up text
        text = ' '.join(text_parts)
        text = re.sub(r'<[^>]+>', ' ', text)  # Remove remaining HTML tags
        text = re.sub(r'\s+', ' ', text)      # Normalize whitespace
        text = text.strip()
        
        # Truncate if too long
        if len(text) > max_length:
            text = text[:max_length] + "..."
            
        return text
    except Exception as e:
        print(f"Error extracting content: {e}")
        return ""

def _clean_scrape_cache():
    """Remove expired cache entries"""
    current_time = time.time()
    expired_keys = [
        k for k, v in _scrape_cache.items() 
        if current_time - v['timestamp'] > _cache_ttl
    ]
    
    for key in expired_keys:
        del _scrape_cache[key]

async def get_online_context(query: str, num_results: int = 3) -> str:
    """Get context from online sources with improved performance"""
    try:
        from search_online import get_serpapi_links
        
        # Get search results
        search_results = get_serpapi_links(query, num_results)
        
        # Early return if no results
        if not search_results:
            return ""
        
        # Process URLs concurrently with a timeout
        tasks = []
        for result in search_results:
            url = result["url"]
            tasks.append(scrape_url(url))
        
        # Wait for all tasks with a timeout and early return
        try:
            # Set a timeout for the entire operation
            content_results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=5  # 5 second total timeout for all scraping
            )
        except asyncio.TimeoutError:
            print("Web scraping timed out, returning partial results")
            # Return whatever we have so far
            return ""
        
        # Process results
        formatted_content = []
        for i, content in enumerate(content_results):
            if isinstance(content, str) and content:
                url = search_results[i]["url"]
                # Limit content length for each source
                formatted_content.append(f"url: {url}\ncontent: {content[:3000]}")  # Reduced from 5000 to 3000
        
        # Return combined content
        return "\n\n".join(formatted_content)
    except Exception as e:
        print(f"Error getting online content: {e}")
        return ""

def scrape_urls(urls, max_workers=5):
    """
    Scrape multiple URLs in parallel with optimized performance.
    
    Args:
        urls: List of URLs to scrape
        max_workers: Maximum number of parallel workers
        
    Returns:
        Combined text from all URLs
    """
    if not urls:
        return ""
        
    # Limit number of URLs to process
    urls = urls[:5]  # Process at most 5 URLs
    
    results = []
    
    # Use ThreadPoolExecutor for parallel scraping
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_url = {executor.submit(scrape_url, url): url for url in urls}
        
        # Process results as they complete
        for future in as_completed(future_to_url):
            url = future_to_url[future]
            try:
                data = future.result()
                if data:
                    # Add source info and content
                    results.append(f"Source: {url}\n{data}\n")
            except Exception as e:
                print(f"Error processing {url}: {e}")
    
    # Combine results
    return "\n\n".join(results)
