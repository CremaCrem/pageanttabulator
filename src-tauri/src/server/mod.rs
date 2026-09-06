pub mod event_routes;
pub mod candidate_routes;
pub mod judge_routes;
pub mod score_routes;
pub mod round_routes;
pub mod admin_routes;
pub mod network_routes;
pub mod ws;

use axum::{routing::{get, post, patch, delete}, Router};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;
use crate::db::AppState;

use tower_http::services::{ServeDir, ServeFile};

pub async fn start_server(app_state: AppState) {
    let frontend_dir = "../dist"; // Path to Vite build output

    let app = Router::new()
        .route("/api/health", get(|| async { r#"{"status":"ok"}"# }))
        .route("/api/network-info", get(network_routes::get_network_info))
        .route("/api/event", get(event_routes::get_event).post(event_routes::update_event))
        .route("/api/candidates", get(candidate_routes::get_candidates).post(candidate_routes::add_candidate))
        .route("/api/candidates/{id}", patch(candidate_routes::update_candidate))
        .route("/api/candidates/{id}/disqualify", patch(candidate_routes::disqualify_candidate))
        .route("/api/judges", get(judge_routes::get_judges))
        .route("/api/judges/session", post(judge_routes::claim_session))
        .route("/api/judges/session/verify", post(judge_routes::verify_session))
        .route("/api/judges/session/{judgeId}", delete(judge_routes::reset_session))
        .route("/api/judges/status", get(judge_routes::get_judge_status))
        .route("/api/scores", post(score_routes::submit_score))
        .route("/api/scores/summary", get(score_routes::get_score_summary))
        .route("/api/scores/all", get(score_routes::get_all_scores))
        .route("/api/scores/judge/{judgeId}", get(score_routes::get_scores_by_judge))
        .route("/api/rounds", get(round_routes::get_rounds))
        .route("/api/rounds/open", post(round_routes::open_round))
        .route("/api/rounds/lock", post(round_routes::lock_round))
        .route("/api/admin/verify-pin", post(admin_routes::verify_pin))
        .route("/api/results/compute", post(admin_routes::compute_results))
        .route("/ws", get(ws::ws_handler))
        .with_state(app_state)
        // Serve static files from ../dist, fallback to index.html for SPA routing
        .fallback_service(
            ServeDir::new(frontend_dir)
                .fallback(ServeFile::new(format!("{}/index.html", frontend_dir)))
        )
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Server listening on {}", addr);
    
    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
