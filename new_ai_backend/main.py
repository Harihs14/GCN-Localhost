import base64
import json
import re
import time
import uuid
import traceback
from datetime import datetime
from difflib import get_close_matches
from typing import Dict, List, Optional, Any
import numpy as np
import psycopg2
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from io import BytesIO
from fastapi.responses import JSONResponse
import os
import random
from bs4 import BeautifulSoup
import requests
import fitz  # PyMuPDF
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import ollama
import asyncio

from search_online import (
    search_images,
    search_videos,
    search_web_links,
    get_serpapi_links
)
from web_scrape import (
    scrape_urls
)
from utils import extract_json

from ollama_chat import (
    chat_ollama
)
from upload_pdf import (
    create_tables,
    extract_pdf_text,
    extract_pdf_info,
    text_to_vector,
    store_in_database,
    search_pdfs,
    delete_pdf,
    update_pdf_info
)

# Database Configuration
DB_CONFIG = {
    "dbname": os.environ.get("DB_NAME", "gcn-legacy"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "postgres"),
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": os.environ.get("DB_PORT", "5432")
}

app = FastAPI()

# Initialize text model
text_model = SentenceTransformer('all-MiniLM-L6-v2')

serp_api_key = os.environ.get("SERPAPI_KEY", "")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Initialize database tables
create_tables()

class QueryRequest(BaseModel):
    query: str
    org_query: str
    chat_id: Optional[str] = None
    userId: Optional[int] = None
    memory: Optional[List[Dict[str, str]]] = None

def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(**DB_CONFIG)

def vector_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def get_search_query(search_query: str) -> str:
    """
    Generate a refined search query using Ollama.
    """
    system_prompt = (
        "# Search Query Optimization Task\n\n"
        "## Objective\n"
        "Generate the most effective search phrase to retrieve high-quality, relevant information for the user's query.\n\n"
        "## Requirements\n"
        "- Create a concise, targeted search phrase (maximum 10 words)\n"
        "- Identify and include key technical terminology and industry-specific vocabulary\n"
        "- Prioritize authoritative sources by including terms like 'official', 'standard', or 'regulation' where appropriate\n"
        "- Include relevant document types (e.g., 'guidelines', 'framework', 'specification')\n"
        "- Remove conversational language, filler words, and non-essential context\n\n"
        "## Output Format\n"
        "Return ONLY the optimized search phrase with no additional text, explanation, or formatting.\n\n"
        "## Examples\n"
        "Input: \"What are the safety requirements I need to follow for storing chemicals?\"\n"
        "Output: \"chemical storage safety requirements regulatory guidelines\"\n\n"
        "Input: \"Can you tell me about ISO 9001 implementation steps?\"\n"
        "Output: \"ISO 9001 implementation process framework official\"\n\n"
        "Input: \"How do GDPR regulations affect data storage?\"\n"
        "Output: \"GDPR data storage compliance requirements official\""
    )
    try:
        # Try with llama3.2 first, then fallback to other models if not available
        available_models = ["llama3.2:latest", "llama3:8b", "llama2:7b", "gemma:2b", "phi3:mini", "mistral:7b"]
        
        for model in available_models:
            try:
                print(f"Trying model: {model}")
                response = chat_ollama(system_prompt, search_query, model=model)
                return response.strip()
            except Exception as e:
                print(f"Error with model {model}: {e}")
                continue
                
        # If all models fail, use the original query
        print("All models failed, using original query")
        return search_query
    except Exception as e:
        print(f"Error generating search query: {e}")
        return search_query  # Fallback to original query

def search_relevant_texts(query_vector: List[float], pdf_names: List[str], threshold: float = 0.6) -> List[dict]:
    """Search for relevant text chunks in the specified PDFs with improved relevance."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        relevant_texts = []
        for pdf_name in pdf_names:
            cur.execute("""
                SELECT text_vectors, pdf_info 
                FROM pdfdata 
                WHERE pdf_name = %s
            """, (pdf_name,))
            
            row = cur.fetchone()
            if row and row[0]:
                vectors = row[0]
                pdf_info = row[1] if row[1] else {}
                
                if isinstance(vectors, str):
                    vectors = json.loads(vectors)
                elif isinstance(vectors, list):
                    vectors = vectors
                else:
                    continue
                    
                # Group text chunks by page for better context
                page_chunks = {}
                for vec_info in vectors:
                    page_num = vec_info['page_number']
                    if page_num not in page_chunks:
                        page_chunks[page_num] = []
                    page_chunks[page_num].append({
                        'text': vec_info['text'],
                        'similarity': vector_similarity(query_vector, vec_info['vector'])
                    })
                
                # Process each page's chunks
                for page_num, chunks in page_chunks.items():
                    # Sort chunks by similarity
                    chunks.sort(key=lambda x: x['similarity'], reverse=True)
                    
                    # Get the best matching chunk for this page
                    best_chunk = chunks[0]
                    if best_chunk['similarity'] >= threshold:
                        # Get surrounding context
                        context = " ".join([chunk['text'] for chunk in chunks[:3]])
                        
                        relevant_texts.append({
                            'pdf_name': pdf_name,
                            'text': context,
                            'page_number': page_num,
                            'similarity': best_chunk['similarity'],
                            'pdf_info': pdf_info
                        })
        
        # Sort by similarity and return top chunks
        relevant_texts.sort(key=lambda x: x['similarity'], reverse=True)
        return relevant_texts[:5]  # Return top 5 most relevant chunks
        
    except Exception as e:
        print(f"Error searching relevant texts: {e}")
        traceback.print_exc()
        return []
    finally:
        cur.close()
        conn.close()

def organize_pdf_references(relevant_texts: List[dict]) -> List[dict]:
    """Organize PDF references with improved context and relevance."""
    pdf_refs = {}
    
    for text in relevant_texts:
        pdf_name = text['pdf_name']
        if pdf_name not in pdf_refs:
            pdf_refs[pdf_name] = {
                "name": pdf_name,
                "page_number": [],
                "relevance_score": 0,
                "context": [],
                "pdf_info": text.get('pdf_info', {})
            }
        
        # Add page number if not already present
        if text['page_number'] not in pdf_refs[pdf_name]["page_number"]:
            pdf_refs[pdf_name]["page_number"].append(text['page_number'])
            pdf_refs[pdf_name]["context"].append({
                "page": text['page_number'],
                "text": text['text'][:200] + "..." if len(text['text']) > 200 else text['text']
            })
        
        # Update relevance score
        pdf_refs[pdf_name]["relevance_score"] = max(
            pdf_refs[pdf_name]["relevance_score"],
            text['similarity']
        )
    
    # Convert to list and sort by relevance
    refs_list = list(pdf_refs.values())
    refs_list.sort(key=lambda x: x['relevance_score'], reverse=True)
    
    return refs_list

def generate_chat_summary(query: str, answer: str) -> dict:
    """Generate a summary and key points from the chat interaction."""
    # This function is deprecated but kept for backward compatibility
    # It now returns a memory-compatible format instead of summary/key_points
    try:
        return [
            {
                "role": "user",
                "content": query
            },
            {
                "role": "assistant",
                "content": answer
            }
        ]
    except Exception as e:
        print(f"Error generating memory format: {e}")
        return []

def get_chat_context(chat_id: str, limit: int = 3) -> str:
    """Get context from previous chat interactions."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get the chat memory using the new schema
        cur.execute("""
            SELECT memory, created_at, updated_at
            FROM chat_memory 
            WHERE chat_id = %s
        """, (chat_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if not result or not result[0]:
            return ""
        
        # Extract memory from the result
        memory_data = result[0]
        
        # Format the context from memory
        context = "Previous conversation context:\n"
        
        # Process the last few exchanges from memory
        if isinstance(memory_data, list):
            # If memory is already a list
            messages = memory_data
        elif isinstance(memory_data, str):
            # If memory is stored as a JSON string
            try:
                messages = json.loads(memory_data)
            except json.JSONDecodeError:
                messages = []
        else:
            messages = []
        
        # Get the last few exchanges (limit * 2 because each exchange has user + assistant messages)
        recent_messages = messages[-limit*2:] if messages else []
        
        # Format the messages
        for i, msg in enumerate(recent_messages):
            role = msg.get('role', '')
            content = msg.get('content', '')
            
            if role == 'user':
                context += f"\nUser: {content}\n"
            elif role == 'assistant':
                context += f"Assistant: {content}\n"
                
        return context
    except Exception as e:
        print(f"Error getting chat context: {e}")
        return ""

def generate_final_answer(query: str, context: str, chat_id: Optional[str] = None) -> str:
    """Generate final answer using available context."""
    try:
        # Get chat history context if available
        chat_context = get_chat_context(chat_id) if chat_id else ""
        
        system_prompt = f"""
        # Global Compliance Navigator Assistant

        ## Role and Purpose
        You are an expert regulatory compliance assistant with deep knowledge of international standards, regulations, and best practices. Your purpose is to provide precise, actionable guidance on compliance matters.

        ## Available Information
        Use the following information sources to formulate your response:

        ### Reference Context:
        ```
        {context}
        ```

        ### Conversation History:
        ```
        {chat_context}
        ```

        ## Response Requirements

        ### Content Guidelines
        1. Provide factually accurate, authoritative information based on provided context
        2. Cite sources precisely using [Source Name] or [Page X] notation
        3. For online sources, include relevant URLs in proper markdown format
        4. Acknowledge limitations in available information when necessary
        5. Maintain a professional, authoritative tone throughout
        6. NEVER include disclaimers in your response

        ### Formatting Requirements
        1. Use markdown formatting to enhance readability
        2. For complex information, utilize appropriate structures:
           - **Tables**: Use markdown tables for comparing multiple items or presenting structured data
           - **Diagrams**: Create ASCII/Unicode diagrams when explaining processes, relationships, or hierarchies
           - **Flowcharts**: Use ASCII/Unicode flowcharts for sequential processes or decision trees
           - **Lists**: Use bullet points for related items and numbered lists for sequential steps
           - **Headers**: Use hierarchical headers (##, ###) to organize information logically

        ### Table Example (use when appropriate):
        ```
        | Standard | Key Requirements | Application Scope | Certification Body |
        |----------|-----------------|-------------------|-------------------|
        | ISO 9001 | Quality Management System | All industries | ISO |
        | GDPR | Data Protection | Personal data in EU | EU Commission |
        ```

        ### Diagram Example (use when appropriate):
        ```
        Compliance Framework Structure:
        
        ┌─────────────────────┐
        │ Regulatory Framework │
        └──────────┬──────────┘
                   │
        ┌──────────┴──────────┐
        │  Organizational     │
        │  Policies           │
        └──────────┬──────────┘
                   │
          ┌────────┴────────┐
          │                 │
  ┌───────┴───────┐ ┌──────┴──────┐
  │ Procedures    │ │ Standards   │
  └───────────────┘ └─────────────┘
        ```

        ### Flowchart Example (use when appropriate):
        ```
        Compliance Assessment Process:
        
        [Start] → (Identify Requirements) → (Gap Analysis) → (Implement Controls)
          ↓                                                        ↓
        (Audit) ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (Document)
          ↓
        (Certification) → [End]
        ```

        ## Response Structure
        1. Begin with a direct, concise answer to the query
        2. Provide detailed explanation with relevant context
        3. Include practical implementation guidance where applicable
        4. Summarize key points at the end for quick reference
        """
        
        # Use chat_ollama for final answer generation
        answer = chat_ollama(system_prompt, query, model="llama3.2:latest")
        
        if not context.startswith("Online Sources"):
            return answer
        return wrap_final_answer(answer, query)
        
    except Exception as e:
        print(f"Error generating final answer: {e}")
        return "I apologize, but I'm having trouble processing your request at the moment."

def get_related_queries(query: str) -> List[str]:
    """Generate related queries based on the input query."""
    system_prompt = f"""
    # Related Compliance Query Generation

    ## Task Description
    Generate 5 highly relevant follow-up questions that compliance professionals would logically ask after the initial query: "{query}"

    ## Query Requirements
    The follow-up questions must:
    1. Demonstrate deep understanding of regulatory compliance domains
    2. Explore different dimensions of the same compliance topic (legal, technical, documentation, implementation, audit)
    3. Follow logical progression from the initial query
    4. Address specific regulatory requirements or standards mentioned or implied
    5. Focus on practical implementation challenges and solutions
    6. Be specific, actionable, and professionally phrased

    ## Topic Dimensions to Cover
    Ensure questions span multiple dimensions:
    - Legal/Regulatory requirements
    - Technical implementation
    - Documentation/Evidence requirements
    - Risk assessment/management
    - Audit/Verification procedures

    ## Output Format
    Return a JSON object with this exact structure:
    {{
        "relevant_queries": [
            "Question 1 text",
            "Question 2 text",
            "Question 3 text",
            "Question 4 text",
            "Question 5 text"
        ]
    }}

    ## Examples of High-Quality Follow-up Questions
    For query "What are ISO 27001 requirements?":
    - "What documentation is required for ISO 27001 certification?"
    - "How should risk assessment be conducted under ISO 27001?"
    - "What are the key differences between ISO 27001:2013 and 2022 versions?"
    - "How often are ISO 27001 surveillance audits conducted?"
    - "What roles and responsibilities should be defined for ISO 27001 implementation?"
    """

    try:
        response = chat_ollama(system_prompt, query, model="llama3.2:latest")
        extracted_json = extract_json(response)
        queries = extracted_json.get("relevant_queries", [])
        
        # If we didn't get valid queries, generate some using a template approach
        if not queries or len(queries) < 5:
            # Fallback to template-based generation
            templates = [
                f"What are the best practices for implementing {query}?",
                f"How do regulatory requirements affect {query}?",
                f"What documentation is required for {query} compliance?",
                f"How do different industries approach {query}?",
                f"What are the latest updates regarding {query}?",
                f"How can organizations measure success in {query}?",
                f"What are common challenges when implementing {query}?",
                f"How does {query} impact risk management?"
            ]
            # Shuffle and take what we need
            import random
            random.shuffle(templates)
            needed = 5 - len(queries)
            queries.extend(templates[:needed])
            
        # Ensure we have exactly 5 queries
        return queries[:5]
    except Exception as e:
        print(f"Error generating related queries: {e}")
        # Provide fallback queries that incorporate the original query
        return [
            f"What are the best practices for {query}?",
            f"How to implement {query} effectively?",
            f"What standards govern {query}?",
            f"What documentation is required for {query}?",
            f"How does {query} impact compliance requirements?"
        ]

def generate_conversational_answer(query: str, chat_context: str) -> str:
    """Generate an answer based on chat history and general knowledge."""
    system_prompt = """
    # Compliance Conversation Continuity Protocol

    ## Role and Context
    You are a senior compliance advisor tasked with maintaining coherent, value-adding conversations about regulatory compliance matters. Your response should demonstrate deep understanding of previous exchanges while providing precise, actionable guidance.

    ## Response Requirements

    ### When Referencing Previous Conversations
    1. Synthesize key compliance concepts discussed previously with technical precision
    2. Identify and highlight regulatory frameworks, standards, or requirements mentioned
    3. Connect current query to previously discussed compliance topics using proper terminology
    4. Reference specific compliance challenges or solutions previously addressed
    5. Maintain consistent technical terminology across conversation turns
    6. Use markdown formatting to structure information hierarchically

    ### When Limited Context is Available
    1. Acknowledge the limited context professionally without apology
    2. Provide authoritative guidance on compliance best practices relevant to the query
    3. Reference applicable regulatory frameworks, standards or guidelines
    4. Suggest structured approaches to addressing the compliance challenge
    5. Offer to explore specific aspects of the compliance topic in greater detail

    ### Professional Standards
    1. Maintain an authoritative yet conversational tone appropriate for compliance professionals
    2. Use industry-standard terminology and proper citation of regulatory references
    3. Organize information logically with appropriate headers and formatting
    4. Include tables, diagrams or flowcharts when they would enhance understanding
    5. Focus on practical implementation guidance rather than theoretical concepts
    6. Avoid disclaimers or unnecessary qualifications

    ## Output Format
    Provide a direct, professionally structured response that builds on previous context when available. Use markdown formatting to enhance readability and organization.
    """
    try:
        response = chat_ollama(system_prompt, f"Chat History:\n{chat_context}\n\nUser Query: {query}")
        return response['message']['content']
    except Exception as e:
        return "I apologize, but I'm having trouble processing the chat history. Would you like to discuss a specific compliance topic instead?"

def generate_chat_name(query: str) -> str:
    """Generate a meaningful chat name from the user's query."""
    system_prompt = """
    # Chat Title Generation Task

    ## Objective
    Create a precise, professional title for this compliance-focused conversation that accurately reflects the core subject matter.

    ## Title Requirements
    1. Length: 3-6 words maximum
    2. Style: Use industry-standard terminology and nomenclature
    3. Format: Apply proper title case capitalization
    4. Content: Include specific standards, regulations, or compliance domains when mentioned
    5. Focus: Capture the central compliance topic, not peripheral details
    6. Precision: Avoid generic terms like "Discussion" or "Overview" unless absolutely necessary

    ## Prohibited Elements
    - Do not include dates or timestamps
    - Do not use phrases like "Chat about" or "Discussion of"
    - Do not include user names or personal references
    - Do not use unnecessary articles (a, an, the) at the beginning

    ## Examples of Excellent Titles
    | Query | Appropriate Title |
    |-------|------------------|
    | "What are the safety requirements for chemical storage according to OSHA?" | "OSHA Chemical Storage Requirements" |
    | "How do I implement ISO 9001 in a manufacturing environment?" | "ISO 9001 Manufacturing Implementation" |
    | "What documentation do I need for FDA medical device compliance?" | "FDA Medical Device Documentation" |
    | "Can you explain the key points of GDPR data protection?" | "GDPR Key Protection Principles" |
    | "What are the steps for SOC 2 certification?" | "SOC 2 Certification Process" |

    ## Output Format
    Return ONLY the title text with no additional explanation, formatting, or quotation marks.
    """
    try:
        response = chat_ollama(system_prompt, query, model="llama3.2:latest")
        # Clean and format the response
        chat_name = response.strip()
        # Remove any quotes and extra whitespace
        chat_name = chat_name.strip('"\'')
        # Ensure proper capitalization
        chat_name = ' '.join(word.capitalize() for word in chat_name.split())
        return chat_name
    except Exception as e:
        print(f"Error generating chat name: {e}")
        # Create a fallback name using the first few words of the query
        words = query.split()[:4]
        return ' '.join(word.capitalize() for word in words)

def get_all_pdf_names() -> List[str]:
    """Retrieve all PDF names from the database."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT pdf_name FROM pdfdata")
    pdf_names = [row[0] for row in cur.fetchall()]
    cur.close()
    conn.close()
    return pdf_names

def get_best_matches(extracted_names: List[str], available_names: List[str]) -> List[str]:
    """Find the closest matching PDF names from available names."""
    best_matches = []
    for name in extracted_names:
        matches = get_close_matches(name, available_names, n=1, cutoff=0.6)
        if matches:
            best_matches.append(matches[0])
    return best_matches

def identify_relevant_pdfs(query: str, userId: int = None) -> List[str]:
    """Use text similarity to identify relevant PDFs."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get PDF names and vectors for this user
        if userId:
            cur.execute("SELECT DISTINCT pdf_name, text_vectors FROM pdfdata WHERE user_id = %s", [userId])
        else:
            cur.execute("SELECT DISTINCT pdf_name, text_vectors FROM pdfdata")
            
        rows = cur.fetchall()
        
        if not rows:
            return []
            
        # Encode query
        query_vector = text_model.encode(query).tolist()
        
        relevant_pdfs = []
        for pdf_name, text_vectors in rows:
            if text_vectors:  # Check if text_vectors exists
                vectors = json.loads(text_vectors) if isinstance(text_vectors, str) else text_vectors
                # Calculate max similarity for this PDF
                max_similarity = max(
                    vector_similarity(query_vector, vec_info['vector'])
                    for vec_info in vectors
                )
                if max_similarity > 0.4:  # Adjust threshold as needed
                    relevant_pdfs.append((pdf_name, max_similarity))
        
        # Sort by relevance and return top 5
        relevant_pdfs.sort(key=lambda x: x[1], reverse=True)
        return [pdf[0] for pdf in relevant_pdfs[:5]]
        
    except Exception as e:
        print(f"Error identifying relevant PDFs: {e}")
        return []
    finally:
        cur.close()
        conn.close()

def wrap_final_answer(answer: str, query: str) -> str:
    """Add an additional layer of processing to improve answer quality using Ollama."""
    system_prompt = """
    # Compliance Response Enhancement Protocol

    ## Task Overview
    You are tasked with reviewing and enhancing a draft compliance response to ensure it meets the highest professional standards before delivery to the end user.

    ## Enhancement Requirements

    ### Content Improvements
    1. Verify factual accuracy and correct any inaccuracies or ambiguities
    2. Ensure comprehensive coverage of all relevant compliance aspects
    3. Add critical regulatory references or citations that may be missing
    4. Incorporate industry best practices and implementation guidance
    5. Include specific compliance requirements, timelines, or penalties where relevant
    6. Maintain absolute technical precision in all regulatory terminology

    ### Structural Enhancements
    1. Organize information in a logical hierarchy using appropriate markdown headers
    2. Convert suitable content to well-formatted tables for easy comparison
    3. Add ASCII/Unicode diagrams or flowcharts for processes or relationships
    4. Use bullet points for parallel concepts and numbered lists for sequential steps
    5. Highlight critical compliance requirements using bold or italic formatting
    6. Ensure proper citation format for all regulatory references

    ### Professional Standards
    1. Maintain authoritative, precise tone appropriate for compliance professionals
    2. Eliminate any hedging language or unnecessary qualifiers
    3. Ensure proper formatting of all technical terms, standards, and regulatory codes
    4. Format URLs as proper markdown links
    5. Remove any disclaimers or unnecessary statements about limitations
    6. Ensure the response is actionable and implementation-focused

    ## Process
    1. Analyze the original query to understand the precise compliance need
    2. Review the draft response against all enhancement requirements
    3. Make necessary improvements while preserving accurate information
    4. Ensure the final response is comprehensive, authoritative, and professionally formatted

    ## Output Format
    Provide the enhanced response directly, with no meta-commentary or explanation about your changes.
    """
    
    try:
        return chat_ollama(
            system_prompt,
            f"Original Query: {query}\n\nDraft Answer: {answer}",
            model="llama3.2:latest"
        )
    except Exception as e:
        print(f"Error wrapping final answer: {e}")
        return answer  # Return original answer if enhancement fails

@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), userId: int = Form(...)):
    """Upload and process a PDF file."""
    try:
        # Read file content
        pdf_bytes = await file.read()
        if not pdf_bytes:
            raise HTTPException(status_code=400, detail="Empty file received")
            
        pdf_name = file.filename.replace(".pdf", "")
        
        # Process text
        text_data = extract_pdf_text(pdf_bytes)
        if not text_data:
            raise HTTPException(status_code=400, detail="No text extracted - possible corrupted PDF")
        
        # Generate info
        pdf_info = extract_pdf_info(text_data)
        
        # Generate vectors
        vectors = text_to_vector(text_data)
        
        # Store in database
        success = store_in_database(pdf_name, pdf_bytes, vectors, pdf_info, userId)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to store PDF in database")
        
        return {"message": f"Successfully processed: {pdf_name}"}
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search-pdfs")
async def search_pdf_documents(search_query: str = None, userId: int = None):
    """Search PDF documents."""
    try:
        if not userId:
            raise HTTPException(status_code=400, detail="User ID is required")
            
        results = search_pdfs(search_query, userId)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/delete-pdf/{pdf_name}")
async def delete_pdf_document(pdf_name: str, userId: int = None):
    """Delete a PDF document."""
    try:
        if not userId:
            raise HTTPException(status_code=400, detail="User ID is required")
            
        success = delete_pdf(pdf_name, userId)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete PDF")
        return {"message": f"Successfully deleted: {pdf_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/update-pdf-info/{pdf_name}")
async def update_pdf_document_info(pdf_name: str, new_info: str, userId: int = None):
    """Update PDF document information."""
    try:
        if not userId:
            raise HTTPException(status_code=400, detail="User ID is required")
            
        success = update_pdf_info(pdf_name, new_info, userId)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update PDF info")
        return {"message": f"Successfully updated info for: {pdf_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/query")
async def process_query(request: QueryRequest) -> Dict:
    try:
        query = request.query
        org_query = request.org_query
        userId = request.userId
        
        if not userId:
            raise HTTPException(status_code=400, detail="User ID is required")
            
        print(f"Processing query: {query}")
        
        # Use asyncio.gather to run multiple operations in parallel
        import asyncio
        
        # Step 1: Start chat name generation and relevant PDFs identification in parallel
        chat_name_task = asyncio.create_task(asyncio.to_thread(generate_chat_name, org_query))
        relevant_pdfs_task = asyncio.create_task(asyncio.to_thread(identify_relevant_pdfs, query, userId))
        
        # Check if SerpAPI is available before starting web search tasks
        serp_api_available = True
        try:
            # Try a minimal SerpAPI request to check availability
            from search_online import check_serpapi_availability
            serp_api_available = await asyncio.to_thread(check_serpapi_availability)
        except Exception as e:
            print(f"SerpAPI availability check failed: {e}")
            serp_api_available = False
        
        # Step 2: Start additional content gathering tasks in parallel only if API is available
        if serp_api_available:
            print("SerpAPI is available, starting web search tasks")
            online_images_task = asyncio.create_task(asyncio.to_thread(search_images, query))
            online_videos_task = asyncio.create_task(asyncio.to_thread(search_videos, query))
            online_links_task = asyncio.create_task(asyncio.to_thread(search_web_links, query))
            # Get online context task will be started later
        else:
            print("SerpAPI is unavailable, skipping web search tasks")
            # Set empty results for web content
            online_images_task = asyncio.create_task(asyncio.to_thread(lambda: []))
            online_videos_task = asyncio.create_task(asyncio.to_thread(lambda: []))
            online_links_task = asyncio.create_task(asyncio.to_thread(lambda: []))
        
        # Always start related queries task as it doesn't depend on SerpAPI
        related_queries_task = asyncio.create_task(asyncio.to_thread(get_related_queries, query))
        
        # Wait for relevant PDFs to be identified before proceeding with PDF context extraction
        relevant_pdfs = await relevant_pdfs_task
        print(f"Found {len(relevant_pdfs)} relevant PDFs")
        
        # Step 3: Extract relevant content and references
        pdf_context = ""
        relevant_texts = []
        pdf_refs = []
        
        if relevant_pdfs:
            query_vector = text_model.encode(query).tolist()
            relevant_texts_task = asyncio.create_task(asyncio.to_thread(search_relevant_texts, query_vector, relevant_pdfs))
            relevant_texts = await relevant_texts_task
            
            if relevant_texts:
                # Prepare PDF context with improved formatting
                pdf_context = "\n\n".join([
                    f"[{text['pdf_name']} Page {text['page_number']}] {text['text']}"
                    for text in relevant_texts
                ])
                
                # Organize PDF references with improved context
                pdf_refs = organize_pdf_references(relevant_texts)
        
        # Step 4: Get online context only if SerpAPI is available
        online_context = ""
        if serp_api_available:
            try:
                online_context = await get_online_context(query)
            except Exception as e:
                print(f"Error getting online context: {e}")
                online_context = ""
        
        # Combine contexts
        context = pdf_context
        if online_context:
            context += f"\n\nOnline Sources:\n\n{online_context}"
        
        # Generate answer (this is CPU-intensive and depends on context, so we don't parallelize it)
        answer_task = asyncio.create_task(asyncio.to_thread(generate_final_answer, query, context, request.chat_id))
        
        # Wait for all remaining tasks to complete
        chat_name = await chat_name_task
        answer = await answer_task
        online_images = await online_images_task
        online_videos = await online_videos_task
        online_links = await online_links_task
        related_queries = await related_queries_task
        
        print(f"Generated chat name: {chat_name}")
        
        # Extract online link metadata from search results if SerpAPI is available
        online_links_data = []
        if serp_api_available:
            try:
                search_results = get_serpapi_links(query, 5)
                
                for result in search_results:
                    online_links_data.append({
                        "url": result["url"],
                        "title": result["title"],
                        "snippet": result["snippet"]
                    })
            except Exception as e:
                print(f"Error getting online links data: {e}")
        
        return {
            "query": org_query,
            "answer": answer,
            "chat_name": chat_name,
            "pdf_references": pdf_refs,
            "online_images": online_images,
            "online_videos": online_videos,
            "online_links": online_links_data,
            "related_queries": related_queries
        }

    except Exception as e:
        print(f"Error in process_query: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

def generate_product_queries(product_title: str, product_info: str) -> List[str]:
    """Generate related queries for a product."""
    system_prompt = """
    # Product-Specific Compliance Query Generation

    ## Task Description
    Generate 3 highly specialized compliance questions tailored specifically for the provided product information. These questions should address critical regulatory and compliance aspects that professionals working with this product would need to address.

    ## Query Requirements
    Each generated question must:
    1. Address specific regulatory or compliance requirements directly relevant to the product domain
    2. Focus on practical implementation challenges unique to this product category
    3. Reference industry-specific standards, frameworks, or regulations where applicable
    4. Be formulated with technical precision using domain-appropriate terminology
    5. Address different compliance dimensions (regulatory, documentation, implementation)

    ## Question Dimensions to Cover
    Ensure questions span multiple compliance aspects:
    - Regulatory requirements and applicable standards
    - Documentation and evidence requirements
    - Implementation and validation procedures
    - Risk assessment and mitigation strategies
    - Audit and verification processes

    ## Output Format
    Return a JSON array containing exactly 3 professionally crafted compliance questions.
    Example format:
    [
        "What specific documentation is required to demonstrate compliance with [relevant standard] for this [product type]?",
        "How should organizations implement the [specific requirement] mandated by [regulation] when deploying this [product]?",
        "What risk assessment methodology is recommended for identifying [specific risks] associated with this [product] under [standard/regulation]?"
    ]

    ## Response Requirements
    - Return ONLY the JSON array with 3 questions
    - Do not include any explanatory text or additional formatting
    - Ensure questions are directly relevant to the specific product information provided
    - Use proper technical terminology appropriate to the product's domain
    """
    try:
        context = f"Product Title: {product_title}\nProduct Info: {product_info}"
        response = chat_ollama(system_prompt, context, model="llama3.2:latest")
        queries = json.loads(response)
        return queries[:3]  # Ensure we only return 3 queries
    except Exception as e:
        print(f"Error generating product queries: {e}")
        return []

@app.post("/api/generate-product-queries")
async def generate_queries(request: dict):
    """Generate and store product-related queries."""
    try:
        product_title = request.get("title")
        product_info = request.get("info")
        
        if not product_title or not product_info:
            raise HTTPException(status_code=400, detail="Product title and info are required")
            
        queries = generate_product_queries(product_title, product_info)
        
        # Store in database
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create table if it doesn't exist
        cur.execute("""
            CREATE TABLE IF NOT EXISTS product_related_queries (
                id SERIAL PRIMARY KEY,
                product_title TEXT NOT NULL,
                query TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Insert queries
        for query in queries:
            cur.execute(
                "INSERT INTO product_related_queries (product_title, query) VALUES (%s, %s)",
                (product_title, query)
            )
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"queries": queries}
    except Exception as e:
        print(f"Error in generate_queries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/random-product-queries")
async def get_random_queries():
    """Get 3 random product-related queries."""
    try:
        # Hardcoded compliance-related queries instead of fetching from DB
        common_queries = [
            "What are the key principles of the Agile Manifesto?",
            "How does MISRA compliance affect automotive software development?",
            "What are the main components of ISO 27001 Information Security Management System?",
            "What software lifecycle processes are defined in ISO/IEC/IEEE 12207?",
            "How does IEC 62304 classify medical device software?",
            "What quality characteristics are defined in ISO/IEC 25010?",
            "What is the relationship between ISO 9001 and ISO/IEC/IEEE 90003?",
            "What test documentation is required according to IEEE 829?",
            "How does ISO/IEC 20000 relate to ITIL?",
            "What are the key test techniques in ISO/IEC/IEEE 29119-4?",
            "Compare the software quality models in ISO 25010 and IEEE 730",
            "How to implement MISRA compliance in an automotive project?",
            "What documentation is required for medical device software under IEC 62304?",
            "How to integrate agile methods with ISO 12207 processes?",
            "What are the key differences between ISO 27001:2013 and previous versions?"
        ]
        
        # Randomly select 3 queries
        selected_queries = random.sample(common_queries, min(3, len(common_queries)))
        
        return {"queries": selected_queries}
    except Exception as e:
        print(f"Error getting random queries: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_online_context(query: str) -> str:
    """Get context from online search results."""
    try:
        from web_scrape import scrape_urls
        from search_online import search_web_links
        
        # Get web links
        links = search_web_links(query)
        
        if not links:
            return ""
            
        # Use the new optimized synchronous scraping function
        online_context = scrape_urls(links, max_workers=3)
        return online_context
        
    except Exception as e:
        print(f"Error getting online context: {e}")
        traceback.print_exc()
        return ""

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
