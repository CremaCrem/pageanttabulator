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

    let event_config = crate::db::event::get(&conn).map_err(|e| e.to_string())?;
    let event_name = event_config.as_ref().map(|c| c.name.clone()).unwrap_or_else(|| "PageantTabulator".to_string());
    let event_subtitle = event_config.as_ref().and_then(|c| c.subtitle.clone());
    
    // Title
    doc.push(elements::Paragraph::new(event_name).aligned(genpdf::Alignment::Center));
    if let Some(subtitle) = event_subtitle {
        doc.push(elements::Paragraph::new(subtitle).aligned(genpdf::Alignment::Center));
    }
    doc.push(elements::Break::new(1));
    doc.push(elements::Paragraph::new("Official Tabulation Results").aligned(genpdf::Alignment::Center));
    doc.push(elements::Break::new(2));

    let mut male_results = Vec::new();
    let mut female_results = Vec::new();

    for res in results {
        if let Some(c) = candidates.iter().find(|c| c.id == res.candidate_id) {
            if c.gender == "male" {
                male_results.push((c.clone(), res.clone()));
            } else {
                female_results.push((c.clone(), res.clone()));
            }
        }
    }

    let render_category = |doc: &mut Document, category_title: &str, mut category_results: Vec<(crate::db::candidates::Candidate, crate::db::results::CandidateResult)>| {
        doc.push(elements::Paragraph::new(category_title).aligned(genpdf::Alignment::Center));
        doc.push(elements::Break::new(1));
        
        // Compute preliminary ranks dynamically for display FIRST
        let mut prelim_ranks = std::collections::HashMap::new();
        category_results.sort_by(|a, b| {
            let a_score = a.1.preliminary_score.unwrap_or(999.0);
            let b_score = b.1.preliminary_score.unwrap_or(999.0);
            a_score.partial_cmp(&b_score).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        let mut current_rank = 1;
        let mut last_score = -1.0;
        for (i, (c, res)) in category_results.iter().enumerate() {
            let score = res.preliminary_score.unwrap_or(999.0);
            if (score - last_score).abs() > f64::EPSILON {
                current_rank = i + 1;
            }
            last_score = score;
            prelim_ranks.insert(c.id.clone(), current_rank);
        }

        doc.push(elements::Paragraph::new("Championship Results (Top 3)"));
        let mut table = elements::TableLayout::new(vec![1, 3, 2, 2, 2, 2]);
        table.set_cell_decorator(elements::FrameCellDecorator::new(true, true, false));
        
        let mut row = table.row();
        row.push_element(elements::Paragraph::new("No."));
        row.push_element(elements::Paragraph::new("Candidate Name"));
        row.push_element(elements::Paragraph::new("Prelim Rank"));
        row.push_element(elements::Paragraph::new("Final Q&A"));
        row.push_element(elements::Paragraph::new("Total"));
        row.push_element(elements::Paragraph::new("Placement"));
        row.push().unwrap();

        let mut top3: Vec<_> = category_results.iter().filter(|(_, r)| r.preliminary_status == "advancing").collect();
        top3.sort_by_key(|a| a.1.rank.unwrap_or(999));

        for (c, res) in top3 {
            let mut row = table.row();
            row.push_element(elements::Paragraph::new(&c.candidate_number));
            row.push_element(elements::Paragraph::new(&c.full_name));
            
            let p_rank = res.preliminary_rank.unwrap_or(999);
            row.push_element(elements::Paragraph::new(format!("{:.0}", p_rank)));
            
            row.push_element(elements::Paragraph::new(res.final_qa_score.map(|s| format!("{:.0}", s)).unwrap_or_else(|| "-".to_string())));
            row.push_element(elements::Paragraph::new(res.final_score.map(|s| format!("{:.2}", s)).unwrap_or_else(|| "-".to_string())));
            
            let placement = match res.rank {
                Some(1) => "Champion",
                Some(2) => "1st Runner-Up",
                Some(3) => "2nd Runner-Up",
                _ => "-",
            };
            row.push_element(elements::Paragraph::new(placement));
            row.push().unwrap();
        }
        doc.push(table);
        doc.push(elements::Break::new(1));

        doc.push(elements::Paragraph::new("Preliminary Standings"));
        let mut table2 = elements::TableLayout::new(vec![1, 3, 2, 2, 2]);
        table2.set_cell_decorator(elements::FrameCellDecorator::new(true, true, false));
        let mut row2 = table2.row();
        row2.push_element(elements::Paragraph::new("No."));
        row2.push_element(elements::Paragraph::new("Candidate Name"));
        row2.push_element(elements::Paragraph::new("Prelim Rank Sum"));
        row2.push_element(elements::Paragraph::new("Rank"));
        row2.push_element(elements::Paragraph::new("Top 3?"));
        row2.push().unwrap();

        for (c, res) in &category_results {
            let mut row2 = table2.row();
            row2.push_element(elements::Paragraph::new(&c.candidate_number));
            row2.push_element(elements::Paragraph::new(&c.full_name));
            row2.push_element(elements::Paragraph::new(res.preliminary_score.map(|s| format!("{:.2}", s)).unwrap_or_else(|| "-".to_string())));
            
            let p_rank = res.preliminary_rank.unwrap_or(999);
            row2.push_element(elements::Paragraph::new(p_rank.to_string()));
            
            row2.push_element(elements::Paragraph::new(if res.preliminary_status == "advancing" { "Yes" } else { "No" }));
            row2.push().unwrap();
        }
        doc.push(table2);
        doc.push(elements::Break::new(2));
    };

    render_category(&mut doc, "MALE CATEGORY", male_results);
    render_category(&mut doc, "FEMALE CATEGORY", female_results);

    // Render to file
    doc.render_to_file(&file_path).map_err(|e| format!("Failed to generate PDF: {}", e))?;

    Ok(format!("PDF successfully saved to {:?}", file_path))
}
