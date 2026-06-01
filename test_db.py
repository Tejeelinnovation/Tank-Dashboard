import os
import re
import sys
import psycopg2

def test_conn():
    if not os.path.exists('.env.local'):
        print(".env.local not found!")
        sys.exit(1)
        
    with open('.env.local', 'r') as f:
        env_content = f.read()
        
    db_url_match = re.search(r'DATABASE_URL=(.+)', env_content)
    if not db_url_match:
        print("DATABASE_URL not found in .env.local")
        sys.exit(1)
        
    db_url = db_url_match.group(1).strip().strip('"').strip("'")
    
    try:
        print("Connecting to PostgreSQL...")
        conn = psycopg2.connect(db_url, sslmode='require', connect_timeout=5)
        cur = conn.cursor()
        print("Executing test query...")
        cur.execute("SELECT 1;")
        res = cur.fetchone()
        print("Result:", res)
        cur.close()
        conn.close()
        print("Database is reachable and healthy!")
    except Exception as e:
        print("Database connection failed:", e)

if __name__ == '__main__':
    test_conn()
