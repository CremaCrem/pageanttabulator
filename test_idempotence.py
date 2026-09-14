with open("run_qa_tests.py", "r") as f:
    content = f.read()

new_code = """
print("\\n--- TEST 4: IDEMPOTENCE (Running Compute Final Winners 3 more times) ---")
for i in range(3):
    post("/results/compute", {"round": "final"})

results = get("/results")
print("\\n[Final Output After 3 Extra Computes (Should be exactly the same)]")
for c in males:
    r = next((r for r in results if r['candidateId'] == c['id']), None)
    if r:
        f_qa = r.get('finalQaScore')
        f_tot = r.get('finalScore')
        print(f"C{c['candidateNumber']} - Prelim: {r.get('preliminaryScore', 0):.4f}, Final QA Rank: {f_qa if f_qa is not None else 'N/A'}, Final Score: {f_tot if f_tot is not None else 'N/A'}, Overall Rank: {r.get('rank')}")
"""

with open("run_qa_tests.py", "w") as f:
    f.write(content + new_code)
