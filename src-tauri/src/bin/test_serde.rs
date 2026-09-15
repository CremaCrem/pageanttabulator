use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EventConfig {
    pub id: i64,
    pub name: String,
    pub subtitle: Option<String>,
    pub event_date: Option<String>,
    pub venue: Option<String>,
    pub judge_count: i64,
    pub admin_pin: String,
    pub head_tabulator: Option<String>,
    pub coordinator: Option<String>,
    pub auditor: Option<String>,
    pub created_at: String,
}

fn main() {
    let c = EventConfig {
        id: 1,
        name: "Test".to_string(),
        subtitle: Some("Sub".to_string()),
        event_date: None,
        venue: None,
        judge_count: 5,
        admin_pin: "1234".to_string(),
        head_tabulator: Some("Tabby".to_string()),
        coordinator: Some("Cordy".to_string()),
        auditor: Some("Audi".to_string()),
        created_at: "now".to_string(),
    };
    println!("{}", serde_json::to_string(&c).unwrap());
}
