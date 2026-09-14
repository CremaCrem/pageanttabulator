import urllib.request
import json
import time

BASE_URL = "http://localhost:3000/api"

def post(path, data):
    req = urllib.request.Request(f"{BASE_URL}{path}", data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as f:
            return json.loads(f.read().decode('utf-8'))
    except Exception as e:
        print("Error on post", path, e)
        return None

def get(path):
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req) as f:
            return json.loads(f.read().decode('utf-8'))
    except Exception as e:
        print("Error on get", path, e)
        return None

print("\n--- RESET EVENT ---")
post("/event", {"name": "Test Event", "adminPin": "1234"})

print("\n--- TEST 1: The N-Way Boundary Tie Test ---")
for i in range(1, 6):
    post("/candidates", {
        "candidateNumber": str(i),
        "fullName": f"Candidate {i}",
        "gender": "male",
        "department": "IT"
    })

cands = get("/candidates")
males = [c for c in cands if c['gender'] == 'male']
males.sort(key=lambda x: int(x['candidateNumber']))

segments = ["production_number", "school_uniform", "professional_attire", "modern_barong", "preliminary_qa"]
criteria = {
    "production_number": ["stage_presence", "energy"],
    "school_uniform": ["neatness", "confidence_bearing"],
    "professional_attire": ["elegance_professionalism", "suitability"],
    "modern_barong": ["elegance_poise", "suitability_creativity"],
    "preliminary_qa": ["content_substance", "clarity_organization"]
}

# C1 gets 100, C2 gets 90, C3/C4/C5 all get 80 (perfect tie for 3rd place)
for judge in ["J1", "J2", "J3"]:
    for segment in segments:
        for idx, c in enumerate(males):
            c_num = idx + 1
            if c_num == 1: score = 100 
            elif c_num == 2: score = 90 
            else: score = 80 
            
            crits = criteria[segment]
            post("/scores", {
                "judgeId": judge, "candidateId": c["id"], "segmentId": segment,
                "criteriaEntries": [{"criterionId": crits[0], "score": score}, {"criterionId": crits[1], "score": score}]
            })

post("/results/compute", {"round": "preliminary"})
results = get("/results")

print("\n[Output Before Tie Resolution]")
for c in males:
    r = next((r for r in results if r['candidateId'] == c['id']), None)
    if r:
        print(f"C{c['candidateNumber']} - Score: {r.get('preliminaryScore', 0):.4f}, Status: {r.get('preliminaryStatus')}")

# Resolve tie: Advance C4, exclude C3 and C5
C3_id = males[2]['id']
C4_id = males[3]['id']
C5_id = males[4]['id']
post("/admin/resolve-tie", {
    "pin": "1234", "stage": "preliminary_boundary",
    "resolutions": [
        {"candidateId": C4_id, "resolution": "advance"},
        {"candidateId": C3_id, "resolution": "exclude"},
        {"candidateId": C5_id, "resolution": "exclude"}
    ]
})
post("/results/compute", {"round": "preliminary"})
results = get("/results")
print("\n[Output After Tie Resolution (Advanced C4)]")
for c in males:
    r = next((r for r in results if r['candidateId'] == c['id']), None)
    if r:
        print(f"C{c['candidateNumber']} - Score: {r.get('preliminaryScore', 0):.4f}, Status: {r.get('preliminaryStatus')}")


print("\n--- TEST 2 & 3: Strict Exclusion & Championship Tie Test ---")
C1_id = males[0]['id']
C2_id = males[1]['id']

# Submit Final QA scores ONLY for C1, C2, C4 (proving exclusion works)
# To force a perfect championship tie between C1 (Prelim Rank 1) and C2 (Prelim Rank 2):
# We need C2 to get Final QA Rank 1, and C1 to get Final QA Rank 2. C4 gets Final QA Rank 3.
for judge in ["J1", "J2", "J3"]:
    for cid, score in [(C2_id, 95), (C1_id, 90), (C4_id, 80)]:
        post("/scores", {
            "judgeId": judge, "candidateId": cid, "segmentId": "final_qa",
            "criteriaEntries": [{"criterionId": "content_substance", "score": score}, {"criterionId": "clarity_organization", "score": score}]
        })

post("/results/compute", {"round": "final"})
results = get("/results")
print("\n[Final Output (Forcing Championship Tie between C1 & C2)]")
for c in males:
    r = next((r for r in results if r['candidateId'] == c['id']), None)
    if r:
        f_qa = r.get('finalQaScore')
        f_tot = r.get('finalScore')
        print(f"C{c['candidateNumber']} - Prelim: {r.get('preliminaryScore', 0):.4f}, Final QA Rank: {f_qa if f_qa is not None else 'N/A'}, Final Score: {f_tot if f_tot is not None else 'N/A'}, Overall Rank: {r.get('rank')}")
    else:
        print(f"C{c['candidateNumber']} - No result")

cands = get("/candidates")
print("\n[Tiebreak Flags]")
for c in [c for c in cands if c['gender'] == 'male']:
    if c['isInTiebreak'] == 1:
        print(f"FLAGGED: {c['fullName']} is in a tie!")

print("\n--- Submitting Tie-Breaking QA Scores ---")
# C1 beats C2 in the tiebreaker
for judge in ["J1", "J2", "J3"]:
    for cid, score in [(C1_id, 100), (C2_id, 80)]:
        post("/scores", {
            "judgeId": judge, "candidateId": cid, "segmentId": "tie_breaking_qa",
            "criteriaEntries": [{"criterionId": "content_substance", "score": score}, {"criterionId": "clarity_organization", "score": score}, {"criterionId": "confidence_delivery", "score": score}, {"criterionId": "relevance", "score": score}]
        })

post("/results/compute", {"round": "final"})
results = get("/results")
print("\n[Final Output After Tie-Breaker (C1 Wins)]")
for c in males:
    r = next((r for r in results if r['candidateId'] == c['id']), None)
    if r:
        f_qa = r.get('finalQaScore')
        f_tot = r.get('finalScore')
        print(f"C{c['candidateNumber']} - Prelim: {r.get('preliminaryScore', 0):.4f}, Final QA Rank: {f_qa if f_qa is not None else 'N/A'}, Final Score: {f_tot if f_tot is not None else 'N/A'}, Overall Rank: {r.get('rank')}")
    else:
        print(f"C{c['candidateNumber']} - No result")

cands = get("/candidates")
print("\n[Tiebreak Flags After Resolution]")
for c in [c for c in cands if c['gender'] == 'male']:
    if c['isInTiebreak'] == 1:
        print(f"FLAGGED: {c['fullName']} is in a tie!")
    else:
        print(f"CLEARED: {c['fullName']}")


print("\n--- TEST 4: IDEMPOTENCE (Running Compute Final Winners 3 more times) ---")
for i in range(3):
    post("/results/compute", {"round": "final"})

results = get("/results")
print("\n[Final Output After 3 Extra Computes (Should be exactly the same)]")
for c in males:
    r = next((r for r in results if r['candidateId'] == c['id']), None)
    if r:
        f_qa = r.get('finalQaScore')
        f_tot = r.get('finalScore')
        print(f"C{c['candidateNumber']} - Prelim: {r.get('preliminaryScore', 0):.4f}, Final QA Rank: {f_qa if f_qa is not None else 'N/A'}, Final Score: {f_tot if f_tot is not None else 'N/A'}, Overall Rank: {r.get('rank')}")
