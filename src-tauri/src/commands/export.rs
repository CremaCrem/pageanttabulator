use tauri::{AppHandle, State, command, Manager};
use crate::db::AppState;
use genpdf::{elements, Document, SimplePageDecorator};
use std::path::PathBuf;
use tauri_plugin_dialog::DialogExt;

#[command]
pub async fn generate_pdf(app: AppHandle, state: State<'_, AppState>) -> Result<String, String> {
    // 1. Ask user where to save the PDF
    let file_path = match app.dialog().file().add_filter("PDF Document", &["pdf"]).blocking_save_file() {
        Some(path) => path.into_path().map_err(|_| "Invalid path".to_string())?,
        None => return Err("User cancelled".to_string()),
    };

    // 2. Fetch data from DB
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let candidates = crate::db::candidates::get_all(&conn).map_err(|e| e.to_string())?;
    let results = crate::db::results::get_overall_results(&conn).map_err(|e| e.to_string())?;

    // 3. Load font
    let mut font_dir_path = PathBuf::from("assets/fonts");
    if !font_dir_path.exists() {
        font_dir_path = PathBuf::from("src-tauri/assets/fonts");
    }
    if !font_dir_path.exists() {
        if let Ok(resource_dir) = app.path().resource_dir() {
            font_dir_path = resource_dir.join("assets/fonts");
        }
    }

    let font_family = genpdf::fonts::from_files(&font_dir_path, "Arial", None)
        .map_err(|e| format!("Failed to load font from {:?}: {}", font_dir_path, e))?;

    // 4. Create PDF Document
    let mut doc = Document::new(font_family);
    doc.set_title("PageantTabulator Results");
    
    let mut decorator = SimplePageDecorator::new();
    decorator.set_margins(10);
    doc.set_page_decorator(decorator);

    // Title
    doc.push(elements::Paragraph::new("PageantTabulator Official Results").aligned(genpdf::Alignment::Center));
    doc.push(elements::Break::new(1));

    // Create a Table
    let mut table = elements::TableLayout::new(vec![1, 3, 2, 2, 2, 1]);
    table.set_cell_decorator(elements::FrameCellDecorator::new(true, true, false));

    // Header
    let mut row = table.row();
    row.push_element(elements::Paragraph::new("No."));
    row.push_element(elements::Paragraph::new("Candidate Name"));
    row.push_element(elements::Paragraph::new("Prelim Score"));
    row.push_element(elements::Paragraph::new("Final Q&A"));
    row.push_element(elements::Paragraph::new("Total"));
    row.push_element(elements::Paragraph::new("Rank"));
    row.push().map_err(|e| e.to_string())?;

    for res in results {
        let candidate = candidates.iter().find(|c| c.id == res.candidate_id);
        let mut row = table.row();
        
        if let Some(c) = candidate {
            row.push_element(elements::Paragraph::new(&c.candidate_number));
            row.push_element(elements::Paragraph::new(&c.full_name));
        } else {
            row.push_element(elements::Paragraph::new("?"));
            row.push_element(elements::Paragraph::new("Unknown"));
        }

        row.push_element(elements::Paragraph::new(res.preliminary_score.map(|s| format!("{:.2}", s)).unwrap_or_else(|| "-".to_string())));
        row.push_element(elements::Paragraph::new(res.final_qa_score.map(|s| format!("{:.2}", s)).unwrap_or_else(|| "-".to_string())));
        row.push_element(elements::Paragraph::new(res.final_score.map(|s| format!("{:.2}", s)).unwrap_or_else(|| "-".to_string())));
        row.push_element(elements::Paragraph::new(res.rank.map(|r| r.to_string()).unwrap_or_else(|| "-".to_string())));

        row.push().map_err(|e| e.to_string())?;
    }

    doc.push(table);

    // Render to file
    doc.render_to_file(&file_path).map_err(|e| format!("Failed to generate PDF: {}", e))?;

    Ok(format!("PDF successfully saved to {:?}", file_path))
}
