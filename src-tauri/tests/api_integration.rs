//! Phase 2 — API-layer integration tests.
//!
//! Fixtures: `docs/scoped/testing-strategy.md` §5.2. Expected values there are locked;
//! do not edit them to make a test pass.
//!
//! These drive the *real* router built by `server::build_router` — the same one
//! `start_server` serves — so requests go through real routing, real serde
//! (`camelCase` DTO contract), and real SQLite. Nothing is stubbed.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use pageanttabulator_lib::{db, server};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast;
use tower::ServiceExt;

const SEGMENT: &str = "best_advocacy";
const PIN: &str = "1234";

/// Fresh router over a throwaway SQLite file, so no test shares state with another.
fn test_app() -> Router {
    let dir = std::env::temp_dir().join(format!("pt-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let conn = db::schema::init_db_with_path(&dir.join("test.db")).unwrap();
    let (ws_sender, _) = broadcast::channel(100);
    server::build_router(db::AppState {
        db: Arc::new(Mutex::new(conn)),
        ws_sender: Arc::new(ws_sender),
    })
}

async fn post(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(uri)
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = res.status();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null))
}

async fn get(app: &Router, uri: &str) -> Value {
    let res = app
        .clone()
        .oneshot(Request::builder().uri(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let bytes = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

/// All four `best_advocacy` criteria at the same score, so RawScore == that score
/// (weights sum to 1.0 — locked by fixture RS-1).
fn flat_criteria(score: u32) -> Value {
    json!([
        { "criterionId": "relevance_alignment", "score": score },
        { "criterionId": "content_substance", "score": score },
        { "criterionId": "clarity_organization", "score": score },
        { "criterionId": "delivery_impact", "score": score },
    ])
}

async fn seed_event(app: &Router) {
    let (status, _) = post(
        app,
        "/api/event",
        json!({ "name": "Test Event", "adminPin": PIN }),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "event seed failed");
}

/// Candidates A and B, both male — the breakdown endpoint ranks within gender.
async fn seed_candidates(app: &Router) {
    for (id, number) in [("A", "1"), ("B", "2")] {
        let (status, _) = post(
            app,
            "/api/candidates",
            json!({
                "id": id,
                "candidateNumber": number,
                "fullName": format!("Candidate {}", id),
                "gender": "male",
                "department": "IDSC",
            }),
        )
        .await;
        assert_eq!(status, StatusCode::OK, "candidate {} seed failed", id);
    }
}

async fn submit(app: &Router, judge: &str, candidate: &str, score: u32) -> (StatusCode, Value) {
    post(
        app,
        "/api/scores",
        json!({
            "judgeId": judge,
            "candidateId": candidate,
            "segmentId": SEGMENT,
            "criteriaEntries": flat_criteria(score),
        }),
    )
    .await
}

async fn manual_entry(app: &Router, judge: &str, candidate: &str, criteria: Value, pin: &str, segment: &str) -> (StatusCode, Value) {
    post(
        app,
        "/api/admin/manual-score-entry",
        json!({
            "pin": pin,
            "judgeId": judge,
            "candidateId": candidate,
            "segmentId": segment,
            "criteriaEntries": criteria,
        }),
    )
    .await
}

/// §5.2 fixture input table: j1 A=90 B=80, j2 A=80 B=90, j3 A=70 B=85.
const SUBMISSIONS: [(&str, &str, u32); 6] = [
    ("j1", "A", 90),
    ("j1", "B", 80),
    ("j2", "A", 80),
    ("j2", "B", 90),
    ("j3", "A", 70),
    ("j3", "B", 85),
];

/// Reads rankSum + finalRank for a candidate out of `/api/results/breakdown`.
fn breakdown_for(breakdown: &Value, candidate: &str) -> (u64, u64) {
    let row = breakdown
        .as_array()
        .expect("breakdown is an array")
        .iter()
        .find(|r| r["candidateId"] == candidate && r["segmentId"] == SEGMENT)
        .unwrap_or_else(|| panic!("no breakdown row for candidate {}", candidate));
    (
        row["rankSum"].as_u64().expect("rankSum"),
        row["finalRank"].as_u64().expect("finalRank"),
    )
}

/// API-1 — three judges submit one segment over HTTP.
/// Expected rank sums inherited from Phase 1 fixture BC-1: A=5, B=4, winner B.
#[tokio::test]
async fn api_1_judges_submit_over_http() {
    let app = test_app();
    seed_candidates(&app).await;

    for (judge, candidate, score) in SUBMISSIONS {
        let (status, body) = submit(&app, judge, candidate, score).await;
        assert_eq!(status, StatusCode::OK);
        assert!(body["error"].is_null(), "submission rejected: {}", body);
    }

    let breakdown = get(&app, "/api/results/breakdown").await;
    assert_eq!(breakdown_for(&breakdown, "A"), (5, 2));
    assert_eq!(breakdown_for(&breakdown, "B"), (4, 1));
}

/// API-2 — resubmission is refused and the first score is preserved.
/// Decision recorded in testing-strategy.md §5.3: first score wins, locked to the judge.
#[tokio::test]
async fn api_2_resubmission_rejected_first_score_wins() {
    let app = test_app();
    seed_candidates(&app).await;

    let (status, body) = submit(&app, "j1", "A", 90).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["computedScore"], json!(90.0));

    let (status, body) = submit(&app, "j1", "A", 50).await;
    assert_eq!(status, StatusCode::OK, "handler returns 200 with an error body");
    assert!(
        body["error"].as_str().unwrap_or_default().contains("already submitted"),
        "expected a rejection, got: {}",
        body
    );

    let scores = get(&app, "/api/scores/all").await;
    let rows = scores.as_array().unwrap();
    assert_eq!(rows.len(), 1, "resubmission must not create a second row");
    assert_eq!(rows[0]["computedScore"], json!(90.0), "first score must survive");
}

/// API-3 — manual entry mixes with judge submissions and yields the same result as API-1.
/// Proves scoring-logic.md §2: manually entered rows are indistinguishable downstream.
#[tokio::test]
async fn api_3_manual_entry_indistinguishable() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    for (judge, candidate, score) in SUBMISSIONS {
        let (status, body) = if judge == "j1" {
            submit(&app, judge, candidate, score).await
        } else {
            manual_entry(&app, judge, candidate, flat_criteria(score), PIN, SEGMENT).await
        };
        assert_eq!(status, StatusCode::OK, "entry failed: {}", body);
    }

    let breakdown = get(&app, "/api/results/breakdown").await;
    assert_eq!(breakdown_for(&breakdown, "A"), (5, 2));
    assert_eq!(breakdown_for(&breakdown, "B"), (4, 1));
}

/// API-4 — manual entry with a wrong admin PIN.
#[tokio::test]
async fn api_4_manual_entry_wrong_pin() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    let (status, body) = manual_entry(&app, "j1", "A", flat_criteria(90), "9999", SEGMENT).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Invalid PIN");

    let scores = get(&app, "/api/scores/all").await;
    assert!(scores.as_array().unwrap().is_empty(), "no row may be written on a bad PIN");
}

/// API-5 — manual entry missing one of the segment's four criteria.
#[tokio::test]
async fn api_5_manual_entry_incomplete_criteria() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    let three_of_four = json!([
        { "criterionId": "relevance_alignment", "score": 90 },
        { "criterionId": "content_substance", "score": 90 },
        { "criterionId": "clarity_organization", "score": 90 },
    ]);
    let (status, body) = manual_entry(&app, "j1", "A", three_of_four, PIN, SEGMENT).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "All criteria are required for this segment");

    let scores = get(&app, "/api/scores/all").await;
    assert!(scores.as_array().unwrap().is_empty());
}

/// API-6 — manual entry with out-of-range scores.
/// scoring-logic.md §2: valid input is 1..=100; `0` is explicitly invalid.
#[tokio::test]
async fn api_6_manual_entry_score_out_of_range() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    for bad in [0, 101] {
        let (status, body) = manual_entry(&app, "j1", "A", flat_criteria(bad), PIN, SEGMENT).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "score {} should be rejected", bad);
        assert_eq!(body["error"], "Scores must be between 1 and 100");
    }

    let scores = get(&app, "/api/scores/all").await;
    assert!(scores.as_array().unwrap().is_empty());
}

/// API-8 — criterion weights are applied correctly over HTTP.
///
/// API-1/API-3 score every criterion the same, so RawScore scales uniformly and their
/// rank sums cannot detect a mis-weighted criterion. This submits Phase 1 fixture RS-1's
/// exact per-criterion scores and asserts RS-1's locked output (84.5) comes back from
/// `POST /api/scores`, which does bite on a wrong weight.
#[tokio::test]
async fn api_8_criterion_weights_applied_over_http() {
    let app = test_app();
    seed_candidates(&app).await;

    // RS-1: scores=[90,80,70,100] against weights=[0.30,0.25,0.25,0.20] => 84.5
    let rs1 = json!([
        { "criterionId": "relevance_alignment", "score": 90 },
        { "criterionId": "content_substance", "score": 80 },
        { "criterionId": "clarity_organization", "score": 70 },
        { "criterionId": "delivery_impact", "score": 100 },
    ]);
    let (status, body) = post(
        &app,
        "/api/scores",
        json!({
            "judgeId": "j1",
            "candidateId": "A",
            "segmentId": SEGMENT,
            "criteriaEntries": rs1,
        }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["computedScore"], json!(84.5));
}

/// API-7 — manual entry for a segment that does not exist.
#[tokio::test]
async fn api_7_manual_entry_unknown_segment() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    let (status, body) = manual_entry(&app, "j1", "A", flat_criteria(90), PIN, "not_a_segment").await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"], "Invalid segment");

    let scores = get(&app, "/api/scores/all").await;
    assert!(scores.as_array().unwrap().is_empty());
}

// ---------------------------------------------------------------------------
// Admin score correction (`POST /api/admin/correct-score`)
//
// Policy: scoring-logic.md §2.1 — judges can never edit their own score; an Admin
// corrects it on their behalf after coordinator + auditor approval.
// ---------------------------------------------------------------------------

async fn correct(
    app: &Router,
    judge: &str,
    candidate: &str,
    criteria: Value,
    pin: &str,
    reason: &str,
) -> (StatusCode, Value) {
    post(
        app,
        "/api/admin/correct-score",
        json!({
            "pin": pin,
            "judgeId": judge,
            "candidateId": candidate,
            "segmentId": SEGMENT,
            "criteriaEntries": criteria,
            "reason": reason,
        }),
    )
    .await
}

/// CR-1 — happy path: the corrected score replaces the original, in place.
#[tokio::test]
async fn cr_1_admin_corrects_submitted_score() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    let (_, submitted) = submit(&app, "j1", "A", 90).await;
    let original_id = submitted["scoreId"].as_str().unwrap().to_string();

    let (status, body) = correct(&app, "j1", "A", flat_criteria(70), PIN, "Judge misread the form").await;
    assert_eq!(status, StatusCode::OK, "correction failed: {}", body);
    assert_eq!(body["previousScore"], json!(90.0));
    assert_eq!(body["computedScore"], json!(70.0));

    let rows = get(&app, "/api/scores/all").await;
    let rows = rows.as_array().unwrap();
    assert_eq!(rows.len(), 1, "correction must rewrite in place, not add a row");
    assert_eq!(rows[0]["computedScore"], json!(70.0));
    assert_eq!(rows[0]["id"], json!(original_id), "score id must be preserved");
}

/// CR-2 — the correction actually changes official results, not just the stored row.
#[tokio::test]
async fn cr_2_correction_changes_official_ranking() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    submit(&app, "j1", "A", 90).await;
    submit(&app, "j1", "B", 80).await;

    let before = get(&app, "/api/results/breakdown").await;
    assert_eq!(breakdown_for(&before, "A"), (1, 1), "A should start ranked 1st");
    assert_eq!(breakdown_for(&before, "B"), (2, 2));

    let (status, _) = correct(&app, "j1", "A", flat_criteria(50), PIN, "Transcription error").await;
    assert_eq!(status, StatusCode::OK);

    let after = get(&app, "/api/results/breakdown").await;
    assert_eq!(breakdown_for(&after, "A"), (2, 2), "A must drop to 2nd after correction");
    assert_eq!(breakdown_for(&after, "B"), (1, 1), "B must rise to 1st");
}

/// CR-3 — a correction is written to the audit log, with old and new values.
#[tokio::test]
async fn cr_3_correction_is_audit_logged() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;
    submit(&app, "j1", "A", 90).await;

    correct(&app, "j1", "A", flat_criteria(70), PIN, "Coordinator approved fix").await;

    let logs = get(&app, "/api/logs").await;
    let entry = logs
        .as_array()
        .unwrap()
        .iter()
        .find(|l| l["message"].as_str().unwrap_or_default().contains("CORRECTED"))
        .expect("a correction must leave an audit log entry");

    let details = entry["details"].as_str().unwrap_or_default();
    assert!(details.contains("Previous: 90"), "log must record the old score: {}", details);
    assert!(details.contains("New: 70"), "log must record the new score: {}", details);
    assert!(details.contains("Coordinator approved fix"), "log must record the reason: {}", details);
}

/// CR-4 — correcting a score that was never submitted is refused.
#[tokio::test]
async fn cr_4_correction_requires_existing_score() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;

    let (status, body) = correct(&app, "j1", "A", flat_criteria(70), PIN, "No score yet").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["code"], "NO_EXISTING_SCORE");

    let rows = get(&app, "/api/scores/all").await;
    assert!(rows.as_array().unwrap().is_empty(), "a failed correction must not insert");
}

/// CR-5 — a reason is mandatory; blank/whitespace is refused and the score is untouched.
#[tokio::test]
async fn cr_5_correction_requires_a_reason() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;
    submit(&app, "j1", "A", 90).await;

    for blank in ["", "   "] {
        let (status, body) = correct(&app, "j1", "A", flat_criteria(70), PIN, blank).await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "blank reason must be refused");
        assert_eq!(body["code"], "REASON_REQUIRED");
    }

    let rows = get(&app, "/api/scores/all").await;
    assert_eq!(rows.as_array().unwrap()[0]["computedScore"], json!(90.0), "score must be untouched");
}

/// CR-6 — the correction endpoint is PIN-gated and range-validated, same as manual entry.
#[tokio::test]
async fn cr_6_correction_rejects_bad_pin_and_bad_scores() {
    let app = test_app();
    seed_event(&app).await;
    seed_candidates(&app).await;
    submit(&app, "j1", "A", 90).await;

    let (status, body) = correct(&app, "j1", "A", flat_criteria(70), "9999", "Reason").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"], "Invalid PIN");

    for bad in [0, 101] {
        let (status, body) = correct(&app, "j1", "A", flat_criteria(bad), PIN, "Reason").await;
        assert_eq!(status, StatusCode::BAD_REQUEST, "score {} must be refused", bad);
        assert_eq!(body["error"], "Scores must be between 1 and 100");
    }

    let rows = get(&app, "/api/scores/all").await;
    assert_eq!(rows.as_array().unwrap()[0]["computedScore"], json!(90.0), "score must be untouched");
}
