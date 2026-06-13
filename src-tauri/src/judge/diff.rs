// src-tauri/src/judge/diff.rs

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, PartialEq, Eq)]
pub struct DiffLine {
    pub line: i32,
    pub expected: String,
    pub actual: String,
}

/// Normalizes a string by replacing CRLF with LF, trimming trailing whitespaces
/// on each line, and stripping trailing newlines at the end of the file.
pub fn normalize_output(text: &str) -> String {
    let mut normalized_lines: Vec<String> = text
        .replace("\r\n", "\n")
        .lines()
        .map(|line| line.trim_end().to_string())
        .collect();

    // Strip trailing empty lines
    while let Some(last) = normalized_lines.last() {
        if last.is_empty() {
            normalized_lines.pop();
        } else {
            break;
        }
    }

    normalized_lines.join("\n")
}

/// Compares actual output with expected output.
/// Returns the diff_info containing line differences if there is a mismatch.
pub fn compare_outputs(actual: &str, expected: &str, checker_type: &str) -> Option<Vec<DiffLine>> {
    match checker_type {
        "strictly_the_same" => {
            if actual == expected {
                None
            } else {
                let actual_lines: Vec<&str> = actual.split('\n').collect();
                let expected_lines: Vec<&str> = expected.split('\n').collect();
                let max_lines = std::cmp::max(actual_lines.len(), expected_lines.len());
                let mut diff = Vec::new();
                for idx in 0..max_lines {
                    let act = actual_lines.get(idx).copied().unwrap_or("");
                    let exp = expected_lines.get(idx).copied().unwrap_or("");
                    if act != exp {
                        diff.push(DiffLine {
                            line: (idx + 1) as i32,
                            expected: exp.to_string(),
                            actual: act.to_string(),
                        });
                    }
                }
                Some(diff)
            }
        }
        "yes_no_ignore_case" => {
            let std_actual = normalize_output(actual).to_lowercase();
            let std_expected = normalize_output(expected).to_lowercase();
            if std_actual == std_expected {
                None
            } else {
                let actual_lines: Vec<&str> = std_actual.lines().collect();
                let expected_lines: Vec<&str> = std_expected.lines().collect();
                let max_lines = std::cmp::max(actual_lines.len(), expected_lines.len());
                let mut diff = Vec::new();
                for idx in 0..max_lines {
                    let act = actual_lines.get(idx).copied().unwrap_or("");
                    let exp = expected_lines.get(idx).copied().unwrap_or("");
                    if act != exp {
                        diff.push(DiffLine {
                            line: (idx + 1) as i32,
                            expected: exp.to_string(),
                            actual: act.to_string(),
                        });
                    }
                }
                Some(diff)
            }
        }
        "floating_point_3" | "floating_point_6" | "floating_point_9" => {
            let eps = match checker_type {
                "floating_point_3" => 1e-3,
                "floating_point_6" => 1e-6,
                "floating_point_9" => 1e-9,
                _ => 1e-6,
            };
            
            let std_actual = normalize_output(actual);
            let std_expected = normalize_output(expected);
            
            let actual_lines: Vec<&str> = std_actual.lines().collect();
            let expected_lines: Vec<&str> = std_expected.lines().collect();
            let max_lines = std::cmp::max(actual_lines.len(), expected_lines.len());
            let mut diff = Vec::new();
            
            for idx in 0..max_lines {
                let act = actual_lines.get(idx).copied().unwrap_or("");
                let exp = expected_lines.get(idx).copied().unwrap_or("");
                
                let act_tokens: Vec<&str> = act.split_whitespace().collect();
                let exp_tokens: Vec<&str> = exp.split_whitespace().collect();
                
                let mut line_match = true;
                if act_tokens.len() != exp_tokens.len() {
                    line_match = false;
                } else {
                    for (t_act, t_exp) in act_tokens.iter().zip(exp_tokens.iter()) {
                        if let (Ok(v_act), Ok(v_exp)) = (t_act.parse::<f64>(), t_exp.parse::<f64>()) {
                            let abs_diff = (v_act - v_exp).abs();
                            let ok = abs_diff <= eps || (v_exp != 0.0 && abs_diff / v_exp.abs() <= eps);
                            if !ok {
                                line_match = false;
                                break;
                            }
                        } else if t_act != t_exp {
                            line_match = false;
                            break;
                        }
                    }
                }
                
                if !line_match {
                    diff.push(DiffLine {
                        line: (idx + 1) as i32,
                        expected: exp.to_string(),
                        actual: act.to_string(),
                    });
                }
            }
            
            if diff.is_empty() {
                None
            } else {
                Some(diff)
            }
        }
        _ => {
            // default is ignore_trailing_space
            let std_actual = normalize_output(actual);
            let std_expected = normalize_output(expected);

            if std_actual == std_expected {
                None
            } else {
                let actual_lines: Vec<&str> = std_actual.lines().collect();
                let expected_lines: Vec<&str> = std_expected.lines().collect();
                let max_lines = std::cmp::max(actual_lines.len(), expected_lines.len());
                let mut diff = Vec::new();

                for idx in 0..max_lines {
                    let act = actual_lines.get(idx).copied().unwrap_or("");
                    let exp = expected_lines.get(idx).copied().unwrap_or("");
                    if act != exp {
                        diff.push(DiffLine {
                            line: (idx + 1) as i32,
                            expected: exp.to_string(),
                            actual: act.to_string(),
                        });
                    }
                }

                Some(diff)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalization() {
        assert_eq!(normalize_output("hello \r\nworld   \r\n"), "hello\nworld");
        assert_eq!(normalize_output("  spaces keep start\n"), "  spaces keep start");
        assert_eq!(normalize_output("\n\n\n"), "");
    }

    #[test]
    fn test_comparison_equal() {
        let actual = "hello \r\nworld\n";
        let expected = "hello\nworld \r\n";
        let diff = compare_outputs(actual, expected, "ignore_trailing_space");
        assert!(diff.is_none());
    }

    #[test]
    fn test_comparison_diff() {
        let actual = "line1\nline2_diff\n";
        let expected = "line1\nline2\nline3\n";
        let diff = compare_outputs(actual, expected, "ignore_trailing_space");
        
        let diff_list = diff.unwrap();
        assert_eq!(diff_list.len(), 2);
        assert_eq!(diff_list[0], DiffLine {
            line: 2,
            expected: "line2".to_string(),
            actual: "line2_diff".to_string(),
        });
        assert_eq!(diff_list[1], DiffLine {
            line: 3,
            expected: "line3".to_string(),
            actual: "".to_string(),
        });
    }

    #[test]
    fn test_strictly_the_same() {
        let actual = "hello \n";
        let expected = "hello\n";
        assert!(compare_outputs(actual, expected, "strictly_the_same").is_some());
        assert!(compare_outputs("hello", "hello", "strictly_the_same").is_none());
    }

    #[test]
    fn test_yes_no_ignore_case() {
        assert!(compare_outputs("yEs \n", "Yes\n", "yes_no_ignore_case").is_none());
        assert!(compare_outputs("no", "NO", "yes_no_ignore_case").is_none());
        assert!(compare_outputs("yes", "no", "yes_no_ignore_case").is_some());
    }

    #[test]
    fn test_floating_point() {
        assert!(compare_outputs("3.1415", "3.142", "floating_point_3").is_none());
        assert!(compare_outputs("3.141592", "3.141593", "floating_point_6").is_none());
        assert!(compare_outputs("3.141592653", "3.141592654", "floating_point_9").is_none());
        
        assert!(compare_outputs("3.14", "3.15", "floating_point_3").is_some());
    }
}
