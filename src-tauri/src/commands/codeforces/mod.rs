// src-tauri/src/commands/codeforces/mod.rs

pub mod dpapi;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, State, Emitter};
use crate::state::AppState;
use crate::errors::ZetaError;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CfProblemSample {
    pub input: String,
    pub output: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CfProblemDetails {
    pub title: String,
    pub time_limit: String,
    pub memory_limit: String,
    pub samples: Vec<CfProblemSample>,
    pub html_description: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CodeforcesConfig {
    pub file_path: String,
    pub problem_id: String,
    pub contest_id: i32,
    pub problem_index: String,
    pub problem_url: String,
    pub parsed_data: String,
}

fn get_session_file_path() -> Result<std::path::PathBuf, ZetaError> {
    let mut exe_path = std::env::current_exe()
        .map_err(|e| ZetaError::Io(format!("Không thể xác định thư mục chạy exe: {}", e)))?;
    exe_path.pop();
    Ok(exe_path.join("codeforces-session.enc"))
}

#[tauri::command]
pub fn cf_save_cookies(cookies_json: String) -> Result<(), ZetaError> {
    let encrypted = dpapi::encrypt(cookies_json.as_bytes())
        .map_err(|e| ZetaError::Fatal(format!("DPAPI encryption failed: {}", e)))?;
    
    let path = get_session_file_path()?;
    std::fs::write(&path, encrypted)
        .map_err(|e| ZetaError::Io(format!("Failed to write session file: {}", e)))?;
        
    Ok(())
}

#[tauri::command]
pub fn cf_load_cookies() -> Result<String, ZetaError> {
    let path = get_session_file_path()?;
    if !path.exists() {
        return Err(ZetaError::Io("Session file does not exist".to_string()));
    }
    
    let encrypted = std::fs::read(&path)
        .map_err(|e| ZetaError::Io(format!("Failed to read session file: {}", e)))?;
        
    let decrypted = dpapi::decrypt(&encrypted)
        .map_err(|e| ZetaError::Fatal(format!("DPAPI decryption failed: {}", e)))?;
        
    let cookies_str = String::from_utf8(decrypted)
        .map_err(|e| ZetaError::Fatal(format!("Decrypted data is not valid UTF-8: {}", e)))?;
        
    Ok(cookies_str)
}

#[tauri::command]
pub fn cf_check_session() -> Result<bool, ZetaError> {
    let cookies_str = match cf_load_cookies() {
        Ok(s) => s,
        Err(_) => return Ok(false),
    };
    
    let cookies: serde_json::Value = match serde_json::from_str(&cookies_str) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };
    
    if let Some(arr) = cookies.as_array() {
        let current_time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        let mut has_session = false;
        
        for cookie in arr {
            let domain = cookie.get("domain").and_then(|v| v.as_str()).unwrap_or("");
            let name = cookie.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let expiration = cookie.get("expirationDate")
                .and_then(|v| v.as_f64().map(|f| f as u64))
                .or_else(|| cookie.get("expiry").and_then(|v| v.as_u64()));
                
            if domain.contains("codeforces.com") && (name == "39a75" || name == "JSESSIONID" || name == "RCPC") {
                if let Some(exp) = expiration {
                    if exp > current_time {
                        has_session = true;
                    }
                } else {
                    has_session = true;
                }
            }
        }
        
        Ok(has_session)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn cf_save_problem_metadata(
    file_path: String,
    problem_id: String,
    contest_id: i32,
    problem_index: String,
    problem_url: String,
    parsed_data: String,
    state: State<'_, AppState>,
) -> Result<(), ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, true).await? {
        Some(pool) => pool,
        None => return Err(ZetaError::Database("Project database is not initialized".to_string())),
    };

    let norm_path = file_path.replace('\\', "/");

    sqlx::query(
        "INSERT OR REPLACE INTO CodeforcesConfig (file_path, problem_id, contest_id, problem_index, problem_url, parsed_data) \
         VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&norm_path)
    .bind(&problem_id)
    .bind(contest_id)
    .bind(&problem_index)
    .bind(&problem_url)
    .bind(&parsed_data)
    .execute(&proj_db)
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn cf_load_problem_metadata(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Option<CodeforcesConfig>, ZetaError> {
    let proj_db = match state.get_db_pool(&file_path, false).await? {
        Some(pool) => pool,
        None => return Ok(None),
    };

    let norm_path = file_path.replace('\\', "/");

    let row = sqlx::query_as::<_, CodeforcesConfig>(
        "SELECT file_path, problem_id, contest_id, problem_index, problem_url, parsed_data \
         FROM CodeforcesConfig WHERE file_path = ?"
    )
    .bind(&norm_path)
    .fetch_optional(&proj_db)
    .await?;

    Ok(row)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SerializableCookie {
    pub name: String,
    pub value: String,
    pub domain: Option<String>,
    pub path: Option<String>,
    pub http_only: Option<bool>,
    pub secure: Option<bool>,
}

fn inject_cookies(win: &tauri::WebviewWindow) {
    if let Ok(cookies_str) = cf_load_cookies() {
        if let Ok(cookies) = serde_json::from_str::<Vec<SerializableCookie>>(&cookies_str) {
            for c in cookies {
                let mut builder = tauri::webview::Cookie::build((c.name, c.value));
                if let Some(ref d) = c.domain {
                    builder = builder.domain(d);
                }
                if let Some(ref p) = c.path {
                    builder = builder.path(p);
                }
                if let Some(h) = c.http_only {
                    builder = builder.http_only(h);
                }
                if let Some(s) = c.secure {
                    builder = builder.secure(s);
                }
                let _ = win.set_cookie(builder.build());
            }
        }
    }
}

#[tauri::command]
pub async fn codeforces_login(app: AppHandle) -> Result<(), ZetaError> {
    let label = "cf-login";
    if let Some(win) = app.get_webview_window(label) {
        let _ = win.set_focus();
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External("https://codeforces.com/enter?back=%2F".parse().unwrap()))
        .title("Codeforces Login")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .always_on_top(false)
        .visible(true);

    let win = builder.build().map_err(|e| ZetaError::Fatal(e.to_string()))?;
    
    inject_cookies(&win);

    // Spawn background task to poll cookies and URL for successful login
    let app_clone = app.clone();
    let label_clone = label.to_string();
    tauri::async_runtime::spawn(async move {
        for _ in 0..300 { // poll for 5 minutes (300 * 1s)
            sleep(Duration::from_secs(1)).await;
            
            // Check if window is still open
            let win = match app_clone.get_webview_window(&label_clone) {
                Some(w) => w,
                None => break,
            };
            
            if let Ok(url) = win.url() {
                let url_str = url.as_str();
                
                // If user is redirected away from /enter and is on codeforces.com
                if !url_str.contains("/enter") && url_str.contains("codeforces.com") {
                    if let Ok(cookies) = win.cookies() {
                        let mut has_session = false;
                        for c in &cookies {
                            let name = c.name();
                            let domain = c.domain().unwrap_or("");
                            if domain.contains("codeforces.com") && (name == "39a75" || name == "JSESSIONID" || name == "RCPC") {
                                has_session = true;
                                break;
                            }
                        }
                        
                        if has_session {
                            // Extract and save cookies!
                            let serializable_cookies: Vec<SerializableCookie> = cookies.iter().map(|c| {
                                SerializableCookie {
                                    name: c.name().to_string(),
                                    value: c.value().to_string(),
                                    domain: c.domain().map(|d| d.to_string()),
                                    path: c.path().map(|p| p.to_string()),
                                    http_only: c.http_only(),
                                    secure: c.secure(),
                                }
                            }).collect();
                            if let Ok(json_str) = serde_json::to_string(&serializable_cookies) {
                                let _ = cf_save_cookies(json_str);
                            }
                            
                            // Verify session to retrieve the handle and notify the frontend
                            let app_handle_clone = app_clone.clone();
                            tauri::async_runtime::spawn(async move {
                                sleep(Duration::from_millis(500)).await;
                                if let Ok(Some(handle)) = codeforces_verify_session(app_handle_clone.clone()).await {
                                    let _ = app_handle_clone.emit("cf-login-success", handle);
                                } else {
                                    let _ = app_handle_clone.emit("cf-login-success", "");
                                }
                            });
                            
                            // Auto close the window
                            let _ = win.destroy();
                            break;
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn codeforces_verify_session(_app: AppHandle) -> Result<Option<String>, ZetaError> {
    let cookies_str = match cf_load_cookies() {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    
    let cookies = match serde_json::from_str::<Vec<SerializableCookie>>(&cookies_str) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };
    
    let jar = std::sync::Arc::new(reqwest::cookie::Jar::default());
    for c in cookies {
        let domain = c.domain.as_deref().unwrap_or(".codeforces.com");
        let cookie_str = format!("{}={}; Domain={}; Path=/", c.name, c.value, domain);
        let url = "https://codeforces.com".parse::<reqwest::Url>().unwrap();
        jar.add_cookie_str(&cookie_str, &url);
    }
    
    let client = reqwest::Client::builder()
        .cookie_provider(jar)
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
        
    let resp = client.get("https://codeforces.com/settings/general")
        .send()
        .await
        .map_err(|e| ZetaError::Fatal(e.to_string()))?;
        
    let status = resp.status();
    
    if status.is_redirection() {
        if let Some(loc) = resp.headers().get(reqwest::header::LOCATION) {
            if let Ok(loc_str) = loc.to_str() {
                if loc_str.contains("/enter") {
                    return Ok(None);
                }
            }
        }
    }
    
    if status == reqwest::StatusCode::OK {
        let html = resp.text().await.map_err(|e| ZetaError::Fatal(e.to_string()))?;
        
        // Find user profile handle link in html
        if let Some(idx) = html.find("/profile/") {
            let start = idx + 9; // length of "/profile/"
            if start < html.len() {
                let sub = &html[start..std::cmp::min(start + 50, html.len())];
                let mut handle = String::new();
                for c in sub.chars() {
                    if c.is_ascii_alphanumeric() || c == '_' || c == '-' {
                        handle.push(c);
                    } else {
                        break;
                    }
                }
                if !handle.is_empty() {
                    return Ok(Some(handle));
                }
            }
        }
    }
    
    Ok(None)
}

fn percent_decode(s: &str) -> String {
    let mut bytes = Vec::new();
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let h1 = chars.next().unwrap_or('0');
            let h2 = chars.next().unwrap_or('0');
            if let Ok(val) = u8::from_str_radix(&format!("{}{}", h1, h2), 16) {
                bytes.push(val);
            }
        } else {
            bytes.extend_from_slice(c.to_string().as_bytes());
        }
    }
    String::from_utf8(bytes).unwrap_or_default()
}

#[tauri::command]
pub async fn codeforces_download_problem(url: String, app: AppHandle) -> Result<CfProblemDetails, ZetaError> {
    let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let label = format!("cf-downloader-{}", unique_id);

    // Create a webview window pointing to the problem URL (visible for debugging)
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(url.parse().map_err(|e| ZetaError::InvalidInput { message: format!("Invalid URL: {}", e) })?))
        .title("Codeforces Downloader Debug")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .visible(true);

    let win = builder.build().map_err(|e| ZetaError::Fatal(e.to_string()))?;
    
    inject_cookies(&win);

    // Wait for the window to load and scrape the page
    let start = std::time::Instant::now();
    let mut scrape_result: Option<CfProblemDetails> = None;
    
    while start.elapsed() < Duration::from_secs(60) {
        sleep(Duration::from_millis(500)).await;
        
        // Check window URL for result hash
        if let Ok(current_url) = win.url() {
            let url_str = current_url.as_str();
            if let Some(hash_idx) = url_str.find("#scrape-result=") {
                let encoded_payload = &url_str[hash_idx + 15..];
                let decoded_str = percent_decode(encoded_payload);
                
                #[derive(Deserialize)]
                #[serde(rename_all = "camelCase")]
                struct RawDownloadResult {
                    title: Option<String>,
                    time_limit: Option<String>,
                    memory_limit: Option<String>,
                    samples: Option<Vec<CfProblemSample>>,
                    html_description: Option<String>,
                    error: Option<String>,
                }
                
                if let Ok(raw) = serde_json::from_str::<RawDownloadResult>(&decoded_str) {
                    if let Some(err) = raw.error {
                        let _ = win.destroy();
                        return Err(ZetaError::Fatal(err));
                    } else if let (Some(title), Some(time_limit), Some(memory_limit), Some(samples), Some(html_description)) = 
                       (raw.title, raw.time_limit, raw.memory_limit, raw.samples, raw.html_description) {
                        scrape_result = Some(CfProblemDetails {
                            title,
                            time_limit,
                            memory_limit,
                            samples,
                            html_description,
                        });
                        break;
                    }
                }
            }
        }
        
        // Execute scraper JS
        let scraper_js = r#"
        (function() {
            try {
                const statementEl = document.querySelector('.problem-statement');
                if (!statementEl) {
                    return;
                }
                if (window.location.hash.includes('scrape-result=')) {
                    return;
                }
                
                function decodeHtml(html) {
                    const temp = document.createElement('textarea');
                    temp.innerHTML = html;
                    return temp.value;
                }
                
                function getLastTextNode(elem, selector) {
                    let selectedNode = elem.querySelector(selector);
                    if (!selectedNode) return null;
                    const styledNode = selectedNode.querySelector('.tex-font-style-sl, .tex-font-style-bf');
                    if (styledNode !== null) {
                        selectedNode = styledNode;
                    }
                    const textNodes = Array.from(selectedNode.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                    return textNodes[textNodes.length - 1];
                }
                
                function parseMainTestBlock(block) {
                    const cloned = block.cloneNode(true);
                    cloned.querySelectorAll('br').forEach(br => {
                        br.replaceWith(document.createTextNode('\n'));
                    });
                    const lines = Array.from(cloned.querySelectorAll('.test-example-line'));
                    if (lines.length === 0) {
                        return cloned.textContent.trim();
                    }
                    return lines.map(el => {
                        el.querySelectorAll('br').forEach(br => {
                            br.replaceWith(document.createTextNode('\n'));
                        });
                        return el.textContent;
                    }).join('\n').trim();
                }
                
                const titleEl = document.querySelector('.problem-statement > .header > .title');
                const timeLimitNode = getLastTextNode(document, '.problem-statement > .header > .time-limit');
                const memoryLimitNode = getLastTextNode(document, '.problem-statement > .header > .memory-limit');
                
                const timeLimitStr = timeLimitNode ? timeLimitNode.textContent.split(' ')[0] : '1';
                const memoryLimitStr = memoryLimitNode ? memoryLimitNode.textContent.split(' ')[0] : '256';
                
                const inputs = document.querySelectorAll('.input pre');
                const outputs = document.querySelectorAll('.output pre');
                const sampleTests = [];
                for (let i = 0; i < inputs.length && i < outputs.length; i++) {
                    sampleTests.push({
                        input: parseMainTestBlock(inputs[i]),
                        output: parseMainTestBlock(outputs[i])
                    });
                }
                
                window.location.hash = "scrape-result=" + encodeURIComponent(JSON.stringify({
                    title: titleEl ? titleEl.textContent.trim() : 'Unknown Problem',
                    timeLimit: parseFloat(timeLimitStr) + ' s',
                    memoryLimit: parseInt(memoryLimitStr, 10) + ' megabytes',
                    samples: sampleTests,
                    htmlDescription: statementEl.outerHTML
                }));
            } catch (e) {
                window.location.hash = "scrape-result=" + encodeURIComponent(JSON.stringify({ error: e.message }));
            }
        })()
        "#;
        
        let _ = win.eval(scraper_js);
    }

    let _ = win.destroy();

    match scrape_result {
        Some(details) => Ok(details),
        None => Err(ZetaError::Fatal("Timed out waiting for problem page to load".to_string())),
    }
}

#[tauri::command]
pub async fn codeforces_submit_solution(
    _url: String,
    contest_id: String,
    problem_index: String,
    lang_id: String,
    source_code: String,
    app: AppHandle,
) -> Result<bool, ZetaError> {
    let unique_id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis();
    let label = format!("cf-submitter-{}", unique_id);

    let submit_url = if contest_id.is_empty() {
        "https://codeforces.com/problemset/submit".to_string()
    } else {
        format!("https://codeforces.com/contest/{}/submit", contest_id)
    };

    // Create a visible webview window pointing to the submit URL
    let builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(submit_url.parse().unwrap()))
        .title("Codeforces Submitter Debug")
        .inner_size(800.0, 600.0)
        .resizable(true)
        .visible(true);

    let win = builder.build().map_err(|e| ZetaError::Fatal(e.to_string()))?;
    
    inject_cookies(&win);

    // Wait for the window to load and submit the code
    let start = std::time::Instant::now();
    let mut submit_success = false;
    let mut js_submitted = false;
    
    while start.elapsed() < Duration::from_secs(60) {
        sleep(Duration::from_millis(500)).await;
        
        if let Ok(current_url) = win.url() {
            let url_str = current_url.as_str();
            
            if url_str.contains("/enter") {
                let _ = win.destroy();
                return Err(ZetaError::Fatal("Not logged in to Codeforces. Please login first.".to_string()));
            }

            // If redirected to submissions/status/my page, it means submit succeeded!
            if url_str.contains("/my") || url_str.contains("/status") || url_str.contains("/submissions") {
                submit_success = true;
                break;
            }

            // Check if there is an error in URL hash
            if let Some(err_idx) = url_str.find("#submit-error=") {
                let encoded_err = &url_str[err_idx + 14..];
                let decoded_err = percent_decode(encoded_err);
                let _ = win.destroy();
                return Err(ZetaError::Fatal(decoded_err));
            }

            // Check if submission has started
            if url_str.contains("#submit-started") {
                js_submitted = true;
            }
            
            // Always check for errors on the page (safe, no side-effects)
            let check_error_js = r#"
            (function() {
                try {
                    const errorEl = document.querySelector('.error, .global-error, .error-message');
                    if (errorEl && errorEl.textContent.trim()) {
                        window.location.hash = "submit-error=" + encodeURIComponent(errorEl.textContent.trim());
                    }
                } catch (e) {
                    window.location.hash = "submit-error=" + encodeURIComponent(e.message);
                }
            })()
            "#;
            let _ = win.eval(check_error_js);
            
            if !js_submitted {
                // Execute submit JS (only once)
                let is_contest = !contest_id.is_empty();
                let display_problem_index = if is_contest { 
                    problem_index.clone() 
                } else { 
                    format!("{}{}", contest_id, problem_index) 
                };
                
                let escaped_code = serde_json::to_string(&source_code).unwrap();
                
                let submit_js = format!(
                    r#"
                    (function() {{
                        try {{
                            if (window.location.hash.includes('submit-started')) {{
                                return;
                            }}
                            
                            const isContest = {};
                            const probInput = isContest 
                                ? document.querySelector('select[name="submittedProblemIndex"]') 
                                : document.querySelector('input[name="submittedProblemCode"]');
                            const langSelect = document.querySelector('select[name="programTypeId"]');
                            const codeTextarea = document.querySelector('textarea[name="source"]') || document.querySelector('#sourceCodeProgram');
                            const submitBtn = document.querySelector('form.submit-form input[type="submit"]') || document.querySelector('input[type="submit"]');
                            const submitForm = document.querySelector('form.submit-form') || document.querySelector('form');
                            
                            if (!probInput || !langSelect || !codeTextarea || !submitForm) {{
                                return;
                            }}
                            
                            probInput.value = "{}";
                            
                            // Select language with robust matching
                            let selectedValue = null;
                            const targetLangId = "{}";
                            for (let option of langSelect.options) {{
                                if (option.value === targetLangId) {{
                                    selectedValue = option.value;
                                    break;
                                }}
                            }}
                            if (!selectedValue) {{
                                let targetName = "";
                                if (targetLangId === "61") targetName = "G++20";
                                else if (targetLangId === "54") targetName = "G++17";
                                else if (targetLangId === "31") targetName = "Python 3";
                                else if (targetLangId === "89") targetName = "PyPy 3";
                                else if (targetLangId === "74") targetName = "Java 17";
                                
                                if (targetName) {{
                                    for (let option of langSelect.options) {{
                                        if (option.textContent.toLowerCase().includes(targetName.toLowerCase())) {{
                                            selectedValue = option.value;
                                            break;
                                        }}
                                    }}
                                }}
                            }}
                            if (!selectedValue) {{
                                selectedValue = langSelect.value;
                            }}
                            langSelect.value = selectedValue;
                            
                            codeTextarea.value = {};
                            
                            const aceEl = document.querySelector('.ace_editor');
                            if (aceEl && window.ace) {{
                                const editor = window.ace.edit(aceEl);
                                editor.setValue({});
                            }}
                            
                            probInput.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            langSelect.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            codeTextarea.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            
                            window.location.hash = "submit-started";
                            
                            if (submitBtn) {{
                                submitBtn.click();
                            }} else {{
                                submitForm.submit();
                            }}
                        }} catch (e) {{
                            window.location.hash = "submit-error=" + encodeURIComponent(e.message);
                        }}
                    }})()
                    "#,
                    is_contest,
                    display_problem_index,
                    lang_id,
                    escaped_code,
                    escaped_code
                );
                
                let _ = win.eval(&submit_js);
            }
        }
    }

    // Give it 2 seconds to show the redirected page to the user before closing
    sleep(Duration::from_secs(2)).await;
    let _ = win.destroy();

    if submit_success {
        Ok(true)
    } else {
        Err(ZetaError::Fatal("Submission failed or timed out. This may be due to duplicate code submission or Codeforces rate limit.".to_string()))
    }
}
