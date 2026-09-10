pub mod admin_routes;
pub mod candidate_routes;
pub mod event_routes;
pub mod judge_routes;
pub mod log_routes;
pub mod network_routes;
pub mod round_routes;
pub mod score_routes;
pub mod upload_routes;
pub mod ws;

use crate::db::AppState;
use axum::{
    http::HeaderValue,
    routing::{delete, get, patch, post},
    Router,
};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

use tower_http::services::{ServeDir, ServeFile};
use tower_http::set_header::SetResponseHeaderLayer;

pub async fn start_server(app_state: AppState) {
    let frontend_dir = "../dist"; // Path to Vite build output

    let app_dir = std::path::Path::new(app_state.db.lock().unwrap().path().unwrap()).parent().unwrap().to_path_buf();
    let uploads_dir = app_dir.join("uploads");
    std::fs::create_dir_all(&uploads_dir).ok();

    let app = Router::new()
        .route("/api/health", get(|| async { r#"{"status":"ok"}"# }))
        .route("/api/network-info", get(network_routes::get_network_info))
        .route(
            "/api/event",
            get(event_routes::get_event).post(event_routes::update_event),
        )
        .route("/api/event/history", get(event_routes::get_history))
        .route("/api/event/reset", post(event_routes::reset_event))
        .route(
            "/api/event/save-close",
            post(event_routes::save_close_event),
        )
        .route(
            "/api/candidates",
            get(candidate_routes::get_candidates).post(candidate_routes::add_candidate),
        )
        .route(
            "/api/candidates/{id}",
            patch(candidate_routes::update_candidate),
        )
        .route(
            "/api/candidates/{id}/disqualify",
            patch(candidate_routes::disqualify_candidate),
        )
        .route(
            "/api/candidates/{id}/tiebreak",
            patch(candidate_routes::toggle_tiebreak),
        )
        .route("/api/judges", get(judge_routes::get_judges))
        .route("/api/judges/{id}", patch(judge_routes::update_judge))
        .route("/api/judges/session", post(judge_routes::claim_session))
        .route(
            "/api/judges/session/verify",
            post(judge_routes::verify_session),
        )
        .route(
            "/api/judges/session/{judgeId}",
            delete(judge_routes::reset_session),
        )
        .route("/api/judges/status", get(judge_routes::get_judge_status))
        .route("/api/scores", post(score_routes::submit_score))
        .route("/api/scores/summary", get(score_routes::get_score_summary))
        .route("/api/scores/all", get(score_routes::get_all_scores))
        .route(
            "/api/scores/judge/{judgeId}",
            get(score_routes::get_scores_by_judge),
        )
        .route("/api/rounds", get(round_routes::get_rounds))
        .route("/api/rounds/open", post(round_routes::open_round))
        .route("/api/rounds/lock", post(round_routes::lock_round))
        .route("/api/admin/verify-pin", post(admin_routes::verify_pin))
        .route("/api/results/compute", post(admin_routes::compute_results))
        .route("/api/results", get(admin_routes::get_results))
        .route("/api/results/breakdown", get(admin_routes::get_results_breakdown))
        .route(
            "/api/results/special-awards",
            get(admin_routes::get_special_awards),
        )
        .route(
            "/api/logs",
            get(log_routes::get_logs).delete(log_routes::clear_logs),
        )
        .route(
            "/api/upload",
            post(upload_routes::upload_image),
        )
        .route(
            "/api/upload/cleanup",
            post(upload_routes::cleanup_orphans),
        )
        .route("/ws", get(ws::ws_handler))
        .with_state(app_state)
        // Serve uploads directory with immutable cache headers
        .nest_service(
            "/uploads",
            tower::ServiceBuilder::new()
                .layer(SetResponseHeaderLayer::overriding(
                    axum::http::header::CACHE_CONTROL,
                    HeaderValue::from_static("public, max-age=31536000, immutable"),
                ))
                .service(ServeDir::new(uploads_dir)),
        )
        // Serve static files from ../dist, fallback to index.html for SPA routing
        .fallback_service(
            ServeDir::new(frontend_dir)
                .fallback(ServeFile::new(format!("{}/index.html", frontend_dir))),
        )
        .layer(CorsLayer::permissive());

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Server listening on {}", addr);

    let listener = TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
