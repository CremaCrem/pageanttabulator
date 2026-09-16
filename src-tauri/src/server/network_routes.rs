use axum::Json;
use local_ip_address::local_ip;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInfoResponse {
    pub local_ip: String,
    pub port: u16,
    pub server_url: String,
    pub judge_url: String,
}

pub async fn get_network_info() -> Json<NetworkInfoResponse> {
    let port = 3000;

    // Primary method: UDP Socket Routing Probe
    // Connects a dummy socket to an external IP to force the OS kernel to resolve
    // which local interface is actually used for active network routing.
    // This bypasses inactive virtual bridges, Docker adapters, and Thunderbolt bridges.
    let ip = std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .map(|addr| addr.ip().to_string())
        .unwrap_or_else(|_| {
            // Secondary fallback: local_ip_address crate (naive interface enumeration)
            local_ip()
                .map(|ip| ip.to_string())
                .unwrap_or_else(|_| "127.0.0.1".to_string())
        });

    let server_url = format!("http://{}:{}", ip, port);

    let response = NetworkInfoResponse {
        local_ip: ip.clone(),
        port,
        server_url: server_url.clone(),
        judge_url: server_url.clone(),
    };

    Json(response)
}
