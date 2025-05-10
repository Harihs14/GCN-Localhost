import json
import re
import os
from io import BytesIO
from typing import Dict, List, Optional
import psycopg2
import pdfplumber
from sentence_transformers import SentenceTransformer

# Database Configuration
DB_CONFIG = {
    "dbname": os.environ.get("DB_NAME", "gcn-legacy"),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "postgres"),
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": os.environ.get("DB_PORT", "5432")
}

# Initialize text model
text_model = SentenceTransformer('all-MiniLM-L6-v2')

def get_db_connection():
    """Create and return a database connection."""
    return psycopg2.connect(**DB_CONFIG)

def create_tables():
    """Create database tables if they don't exist"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Create main table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pdfdata (
                pdf_name TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                pdf_file BYTEA,
                text_vectors JSONB,
                pdf_info TEXT
            )
        """)
        
        conn.commit()
    except Exception as e:
        print(f"Error creating tables: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Extracts text from PDF with page numbers."""
    text = []
    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                text.append(f"{page_text}\n[page no; {page_num}]")
    except Exception as e:
        print(f"Error extracting text: {e}")
    return "\n\n".join(text)

def extract_pdf_info(text: str) -> str:
    """Extract first 300 words as PDF info."""
    words = text.split()[:300]
    return ' '.join(words)

def text_to_vector(text: str) -> List[Dict]:
    """Converts text to vectors with page numbers."""
    vectors = []
    pages = re.split(r'\n\[page no; (\d+)\]', text)
    current_page = 1
    
    for i in range(0, len(pages)-1, 2):
        try:
            text_chunk = pages[i].strip()
            page_number = int(pages[i+1]) if i+1 < len(pages) else current_page
            if text_chunk:
                vector = text_model.encode(text_chunk, convert_to_tensor=False).tolist()
                vectors.append({
                    "vector": vector,
                    "text": text_chunk,
                    "page_number": page_number
                })
                current_page = page_number
        except Exception as e:
            print(f"Error processing text chunk: {e}")
    return vectors

def store_in_database(pdf_name: str, pdf_bytes: bytes, vectors: List[Dict], pdf_info: str, user_id: int) -> bool:
    """Stores data in PostgreSQL database"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Insert into pdfdata
        cur.execute("""
            INSERT INTO pdfdata (pdf_name, pdf_file, text_vectors, pdf_info, user_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (pdf_name) DO UPDATE
            SET pdf_file = EXCLUDED.pdf_file,
                text_vectors = EXCLUDED.text_vectors,
                pdf_info = EXCLUDED.pdf_info,
                user_id = EXCLUDED.user_id
        """, (pdf_name, psycopg2.Binary(pdf_bytes), json.dumps(vectors), pdf_info, user_id))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"Database error: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()

def search_pdfs(search_query: Optional[str] = None, user_id: Optional[int] = None) -> List[Dict]:
    """Search PDFs in database"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if user_id is None:
            return []
            
        if search_query:
            cur.execute("""
                SELECT pdf_name, pdf_info FROM pdfdata 
                WHERE (pdf_name ILIKE %s OR pdf_info ILIKE %s)
                AND user_id = %s
            """, (f'%{search_query}%', f'%{search_query}%', user_id))
        else:
            cur.execute("SELECT pdf_name, pdf_info FROM pdfdata WHERE user_id = %s", [user_id])
            
        results = cur.fetchall()
        return [{"name": row[0], "info": row[1]} for row in results]
    finally:
        cur.close()
        conn.close()

def delete_pdf(pdf_name: str, user_id: Optional[int] = None) -> bool:
    """Delete PDF from database"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if user_id is None:
            return False
            
        cur.execute("DELETE FROM pdfdata WHERE pdf_name = %s AND user_id = %s", (pdf_name, user_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Delete error: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()

def update_pdf_info(pdf_name: str, new_info: str, user_id: Optional[int] = None) -> bool:
    """Update PDF information"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if user_id is None:
            return False
            
        cur.execute("""
            UPDATE pdfdata 
            SET pdf_info = %s 
            WHERE pdf_name = %s AND user_id = %s
        """, (new_info, pdf_name, user_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Update error: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()
        conn.close()
