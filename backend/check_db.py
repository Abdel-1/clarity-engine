import sqlite3, os

# find the db file
for f in os.listdir("."):
    if f.endswith(".db"):
        print("Found DB:", f)
        conn = sqlite3.connect(f)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        print("Tables:", cur.fetchall())
        try:
            rows = cur.execute("SELECT id, sub_clarity, sub_alignment, sub_focus, sub_tone, sub_narrative_contribution, clarity_score FROM analyses LIMIT 10").fetchall()
            print("Samples:")
            for r in rows:
                print(r)
        except Exception as e:
            print("Error:", e)
        conn.close()
