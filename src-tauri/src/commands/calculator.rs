// src-tauri/src/commands/calculator.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use crate::errors::ZetaError;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalcResult {
    pub result: String,
    pub info: Option<String>,
    pub warning: Option<String>,
    pub exec_time_us: u64,
    pub vars: HashMap<String, String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum CalcValue {
    Num(i128),
    Str(String),
    Arr(Vec<i128>),
    Matrix(Vec<Vec<i128>>),
}

impl CalcValue {
    pub fn to_display_string(&self) -> String {
        match self {
            CalcValue::Num(n) => n.to_string(),
            CalcValue::Str(s) => s.clone(),
            CalcValue::Arr(arr) => format!("[{}]", arr.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(", ")),
            CalcValue::Matrix(mat) => {
                let rows: Vec<String> = mat.iter()
                    .map(|row| format!("[{}]", row.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",")))
                    .collect();
                format!("[{}]", rows.join(","))
            }
        }
    }

    pub fn as_i128(&self) -> Result<i128, String> {
        match self {
            CalcValue::Num(n) => Ok(*n),
            CalcValue::Str(s) => parse_i128(s).ok_or_else(|| format!("Cannot convert '{}' to integer", s)),
            _ => Err("Array or Matrix value cannot be directly converted to an integer".to_string()),
        }
    }
}

#[tauri::command]
pub async fn eval_cp_expr(
    expr: String,
    mod_val: Option<String>,
    ans_val: Option<String>,
    vars: Option<HashMap<String, String>>,
) -> Result<CalcResult, ZetaError> {
    let start_time = Instant::now();
    let mut current_vars = vars.unwrap_or_default();
    
    let trimmed_expr = expr.trim();
    if trimmed_expr.is_empty() {
        return Ok(CalcResult {
            result: "0".to_string(),
            info: None,
            warning: None,
            exec_time_us: start_time.elapsed().as_micros() as u64,
            vars: current_vars,
        });
    }

    // Parse variable assignment if present (e.g. "x = 42" or "a = gcd(48, 18)")
    let (target_var, eval_target) = if let Some(pos) = find_assignment_op(trimmed_expr) {
        let var_name = trimmed_expr[..pos].trim();
        let rhs = trimmed_expr[pos + 1..].trim();
        if is_valid_var_name(var_name) {
            (Some(var_name.to_string()), rhs)
        } else {
            (None, trimmed_expr)
        }
    } else {
        (None, trimmed_expr)
    };

    let active_mod = mod_val.and_then(|m| parse_mod_str(&m));
    let ans_num = ans_val.and_then(|a| parse_i128(&a)).unwrap_or(0);

    // Evaluate expression with context
    let mut evaluator = CpEvaluator::new(active_mod, ans_num, &current_vars);
    let eval_res = evaluator.evaluate(eval_target);

    match eval_res {
        Ok(val) => {
            let res_str = val.to_display_string();
            let mut warning = evaluator.warning;

            if let Some(var_name) = target_var {
                current_vars.insert(var_name.clone(), res_str.clone());
            }

            // Formatting & Trim info
            let mut info = None;
            let mut display_res = res_str.clone();

            match &val {
                CalcValue::Num(n) => {
                    if res_str.len() > 18 {
                        info = Some(format!("[{} digits]", res_str.len()));
                        let prefix = &res_str[..9];
                        let suffix = &res_str[res_str.len() - 6..];
                        display_res = format!("{} … {}", prefix, suffix);
                    }
                    if *n > 1_000_000_000_000_000_000_i128 {
                        if warning.is_none() {
                            warning = Some("Notice: Large integer result (exceeds 10^18)".to_string());
                        }
                    }
                }
                CalcValue::Arr(arr) => {
                    if arr.len() > 15 {
                        info = Some(format!("[{} elements]", arr.len()));
                        let preview: Vec<String> = arr.iter().take(5).map(|v| v.to_string()).collect();
                        display_res = format!("[{}, …]", preview.join(", "));
                    }
                }
                CalcValue::Str(s) => {
                    if s.len() > 50 {
                        info = Some(format!("[{} characters]", s.len()));
                        display_res = format!("{}…", &s[..35]);
                    }
                }
                CalcValue::Matrix(mat) => {
                    let rows = mat.len();
                    let cols = mat.first().map(|r| r.len()).unwrap_or(0);
                    if res_str.len() > 60 {
                        info = Some(format!("[{} rows × {} cols]", rows, cols));
                        display_res = format!("{}×{} matrix", rows, cols);
                    }
                }
            }

            Ok(CalcResult {
                result: display_res,
                info,
                warning,
                exec_time_us: start_time.elapsed().as_micros() as u64,
                vars: current_vars,
            })
        }
        Err(err_msg) => Err(ZetaError::InvalidInput { message: err_msg }),
    }
}

fn find_assignment_op(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    for i in 0..bytes.len() {
        if bytes[i] == b'=' {
            let prev = if i > 0 { bytes[i - 1] } else { 0 };
            let next = if i + 1 < bytes.len() { bytes[i + 1] } else { 0 };
            if prev != b'=' && prev != b'<' && prev != b'>' && prev != b'!' && next != b'=' {
                return Some(i);
            }
        }
    }
    None
}

fn is_valid_var_name(s: &str) -> bool {
    if s.is_empty() { return false; }
    let first = s.chars().next().unwrap_or(' ');
    if !first.is_alphabetic() && first != '_' { return false; }
    s.chars().all(|c| c.is_alphanumeric() || c == '_')
}

fn parse_mod_str(s: &str) -> Option<i128> {
    match s {
        "1e9+7" => Some(1_000_000_007),
        "998244353" => Some(998_244_353),
        "1e9+9" => Some(1_000_000_009),
        _ => parse_i128(s),
    }
}

fn parse_i128(s: &str) -> Option<i128> {
    let clean = s.trim();
    if clean.starts_with("0x") || clean.starts_with("0X") {
        i128::from_str_radix(&clean[2..], 16).ok()
    } else if clean.starts_with("0b") || clean.starts_with("0B") {
        i128::from_str_radix(&clean[2..], 2).ok()
    } else if clean.starts_with("0o") || clean.starts_with("0O") {
        i128::from_str_radix(&clean[2..], 8).ok()
    } else {
        clean.parse::<i128>().ok()
    }
}

struct CpEvaluator<'a> {
    active_mod: Option<i128>,
    ans_val: i128,
    vars: &'a HashMap<String, String>,
    pub warning: Option<String>,
}

impl<'a> CpEvaluator<'a> {
    fn new(active_mod: Option<i128>, ans_val: i128, vars: &'a HashMap<String, String>) -> Self {
        Self {
            active_mod,
            ans_val,
            vars,
            warning: None,
        }
    }

    fn evaluate(&mut self, expr: &str) -> Result<CalcValue, String> {
        let tokens = tokenize(expr)?;
        let mut pos = 0;
        let res = self.parse_expr(&tokens, &mut pos)?;
        if pos < tokens.len() {
            return Err(format!("Invalid trailing syntax near: '{:?}'", tokens[pos]));
        }
        Ok(res)
    }

    fn parse_expr(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        self.parse_bitwise_or(tokens, pos)
    }

    fn parse_bitwise_or(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let mut left = self.parse_bitwise_xor(tokens, pos)?;
        while *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "|" || op == "OR" {
                    *pos += 1;
                    let right = self.parse_bitwise_xor(tokens, pos)?;
                    left = CalcValue::Num(left.as_i128()? | right.as_i128()?);
                    continue;
                }
            }
            break;
        }
        Ok(left)
    }

    fn parse_bitwise_xor(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let mut left = self.parse_bitwise_and(tokens, pos)?;
        while *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "^" || op == "XOR" {
                    *pos += 1;
                    let right = self.parse_bitwise_and(tokens, pos)?;
                    left = CalcValue::Num(left.as_i128()? ^ right.as_i128()?);
                    continue;
                }
            }
            break;
        }
        Ok(left)
    }

    fn parse_bitwise_and(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let mut left = self.parse_shift(tokens, pos)?;
        while *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "&" || op == "AND" {
                    *pos += 1;
                    let right = self.parse_shift(tokens, pos)?;
                    left = CalcValue::Num(left.as_i128()? & right.as_i128()?);
                    continue;
                }
            }
            break;
        }
        Ok(left)
    }

    fn parse_shift(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let mut left = self.parse_add_sub(tokens, pos)?;
        while *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "<<" || op == "SHL" {
                    *pos += 1;
                    let right = self.parse_add_sub(tokens, pos)?;
                    left = CalcValue::Num(left.as_i128()? << right.as_i128()?);
                    continue;
                } else if op == ">>" || op == "SHR" {
                    *pos += 1;
                    let right = self.parse_add_sub(tokens, pos)?;
                    left = CalcValue::Num(left.as_i128()? >> right.as_i128()?);
                    continue;
                }
            }
            break;
        }
        Ok(left)
    }

    fn parse_add_sub(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let mut left = self.parse_mul_div(tokens, pos)?;
        while *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "+" {
                    *pos += 1;
                    let right = self.parse_mul_div(tokens, pos)?;
                    let mut res = left.as_i128()?.wrapping_add(right.as_i128()?);
                    if let Some(m) = self.active_mod { res = ((res % m) + m) % m; }
                    left = CalcValue::Num(res);
                    continue;
                } else if op == "-" {
                    *pos += 1;
                    let right = self.parse_mul_div(tokens, pos)?;
                    let mut res = left.as_i128()?.wrapping_sub(right.as_i128()?);
                    if let Some(m) = self.active_mod { res = ((res % m) + m) % m; }
                    left = CalcValue::Num(res);
                    continue;
                }
            }
            break;
        }
        Ok(left)
    }

    fn parse_mul_div(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let mut left = self.parse_pow(tokens, pos)?;
        while *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "*" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    let mut res = left.as_i128()?.wrapping_mul(right.as_i128()?);
                    if let Some(m) = self.active_mod { res = ((res % m) + m) % m; }
                    left = CalcValue::Num(res);
                    continue;
                } else if op == "/" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    let r_num = right.as_i128()?;
                    if r_num == 0 { return Err("Division by zero error".to_string()); }
                    left = CalcValue::Num(left.as_i128()? / r_num);
                    continue;
                } else if op == "%" || op == "MOD" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    let r_num = right.as_i128()?;
                    if r_num == 0 { return Err("Modulo by zero error".to_string()); }
                    left = CalcValue::Num(left.as_i128()? % r_num);
                    continue;
                }
            }
            break;
        }
        Ok(left)
    }

    fn parse_pow(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        let left = self.parse_primary(tokens, pos)?;
        if *pos < tokens.len() {
            if let Token::Op(ref op) = tokens[*pos] {
                if op == "**" || op == "^" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    let mod_val = self.active_mod;
                    let res = mod_pow(left.as_i128()?, right.as_i128()?, mod_val);
                    return Ok(CalcValue::Num(res));
                }
            }
        }
        Ok(left)
    }

    fn parse_primary(&mut self, tokens: &[Token], pos: &mut usize) -> Result<CalcValue, String> {
        if *pos >= tokens.len() {
            return Err("Missing operator or argument".to_string());
        }

        match &tokens[*pos] {
            Token::Num(n) => {
                *pos += 1;
                Ok(CalcValue::Num(*n))
            }
            Token::StrLit(s) => {
                *pos += 1;
                Ok(CalcValue::Str(s.clone()))
            }
            Token::Ident(id) => {
                let name = id.clone();
                *pos += 1;

                if *pos < tokens.len() && tokens[*pos] == Token::LParen {
                    // Function Call
                    *pos += 1;
                    let mut args = Vec::new();
                    if *pos < tokens.len() && tokens[*pos] != Token::RParen {
                        loop {
                            let arg = self.parse_expr(tokens, pos)?;
                            args.push(arg);
                            if *pos < tokens.len() && tokens[*pos] == Token::Comma {
                                *pos += 1;
                            } else {
                                break;
                            }
                        }
                    }
                    if *pos >= tokens.len() || tokens[*pos] != Token::RParen {
                        return Err(format!("Missing closing parenthesis ')' for function {}", name));
                    }
                    *pos += 1;
                    self.eval_func(&name, &args)
                } else {
                    // Variable reference
                    if name == "ans" {
                        Ok(CalcValue::Num(self.ans_val))
                    } else if name == "M" {
                        Ok(CalcValue::Num(self.active_mod.unwrap_or(1_000_000_007)))
                    } else if let Some(val_str) = self.vars.get(&name) {
                        if let Some(n) = parse_i128(val_str) {
                            Ok(CalcValue::Num(n))
                        } else {
                            Ok(CalcValue::Str(val_str.clone()))
                        }
                    } else {
                        Err(format!("Undefined variable or function: '{}'", name))
                    }
                }
            }
            Token::LParen => {
                *pos += 1;
                let val = self.parse_expr(tokens, pos)?;
                if *pos >= tokens.len() || tokens[*pos] != Token::RParen {
                    return Err("Missing closing parenthesis ')'".to_string());
                }
                *pos += 1;
                Ok(val)
            }
            Token::LBracket => {
                *pos += 1;
                let mut elements = Vec::new();
                if *pos < tokens.len() && tokens[*pos] != Token::RBracket {
                    loop {
                        let elem = self.parse_expr(tokens, pos)?;
                        elements.push(elem);
                        if *pos < tokens.len() && tokens[*pos] == Token::Comma {
                            *pos += 1;
                        } else {
                            break;
                        }
                    }
                }
                if *pos >= tokens.len() || tokens[*pos] != Token::RBracket {
                    return Err("Missing closing bracket ']'".to_string());
                }
                *pos += 1;

                let is_matrix = elements.iter().all(|e| matches!(e, CalcValue::Arr(_)));
                if is_matrix && !elements.is_empty() {
                    let mut mat = Vec::new();
                    for e in elements {
                        if let CalcValue::Arr(arr) = e {
                            mat.push(arr);
                        }
                    }
                    Ok(CalcValue::Matrix(mat))
                } else {
                    let mut arr = Vec::new();
                    for e in elements {
                        arr.push(e.as_i128()?);
                    }
                    Ok(CalcValue::Arr(arr))
                }
            }
            Token::Op(op) if op == "-" => {
                *pos += 1;
                let val = self.parse_primary(tokens, pos)?;
                Ok(CalcValue::Num(-val.as_i128()?))
            }
            Token::Op(op) if op == "+" => {
                *pos += 1;
                self.parse_primary(tokens, pos)
            }
            Token::Op(op) if op == "~" || op == "NOT" => {
                *pos += 1;
                let val = self.parse_primary(tokens, pos)?;
                Ok(CalcValue::Num(!val.as_i128()?))
            }
            _ => Err(format!("Invalid syntax at: '{:?}'", tokens[*pos])),
        }
    }

    fn eval_func(&mut self, name: &str, args: &[CalcValue]) -> Result<CalcValue, String> {
        let get_num = |idx: usize, func_name: &str| -> Result<i128, String> {
            args.get(idx)
                .ok_or_else(|| format!("Function {} requires at least {} arguments", func_name, idx + 1))?
                .as_i128()
        };

        match name {
            // --- Number Theory ---
            "gcd" => {
                let a = get_num(0, "gcd")?;
                let b = get_num(1, "gcd")?;
                Ok(CalcValue::Num(gcd(a, b)))
            }
            "lcm" => {
                let a = get_num(0, "lcm")?;
                let b = get_num(1, "lcm")?;
                let g = gcd(a, b);
                if g == 0 { Ok(CalcValue::Num(0)) } else { Ok(CalcValue::Num((a / g) * b)) }
            }
            "pow" => {
                let a = get_num(0, "pow")?;
                let b = get_num(1, "pow")?;
                let m = if args.len() >= 3 { Some(get_num(2, "pow")?) } else { self.active_mod };
                Ok(CalcValue::Num(mod_pow(a, b, m)))
            }
            "phi" => {
                let n = get_num(0, "phi")?;
                Ok(CalcValue::Num(phi(n)))
            }
            "extgcd" => {
                let a = get_num(0, "extgcd")?;
                let b = get_num(1, "extgcd")?;
                let (g, x, y) = extgcd(a, b);
                Ok(CalcValue::Str(format!("g={}, x={}, y={}", g, x, y)))
            }
            "modinv" => {
                let a = get_num(0, "modinv")?;
                let m = if args.len() >= 2 { get_num(1, "modinv")? } else { self.active_mod.unwrap_or(1_000_000_007) };
                let (g, x, _) = extgcd(a, m);
                if g != 1 {
                    Err(format!("Modular inverse does not exist (gcd({}, {}) = {})", a, m, g))
                } else {
                    Ok(CalcValue::Num(((x % m) + m) % m))
                }
            }
            "sqrt" => {
                let n = get_num(0, "sqrt")?;
                if n < 0 { return Err("Square root of negative number is invalid for integers".to_string()); }
                Ok(CalcValue::Num(isqrt(n)))
            }
            "ilog2" => {
                let n = get_num(0, "ilog2")?;
                if n <= 0 { return Err("ilog2(n) requires n > 0".to_string()); }
                let mut pos = 0i128;
                let mut temp = n;
                while temp > 1 { temp >>= 1; pos += 1; }
                Ok(CalcValue::Num(pos))
            }
            "is_prime" => {
                let n = get_num(0, "is_prime")?;
                if n > 1_000_000_000_000_i128 {
                    self.warning = Some(format!("Warning: n={} is large for prime check", n));
                }
                Ok(CalcValue::Str(if is_prime(n) { "true".to_string() } else { "false".to_string() }))
            }
            "factorize" => {
                let n = get_num(0, "factorize")?;
                if n > 1_000_000_000_000_i128 {
                    self.warning = Some("Warning: n is large for prime factorization".to_string());
                }
                Ok(CalcValue::Str(factorize(n)))
            }
            "divisors" => {
                let n = get_num(0, "divisors")?;
                if n > 1_000_000_000_000_i128 {
                    self.warning = Some("Warning: n is large for listing divisors".to_string());
                }
                Ok(CalcValue::Arr(divisors(n)))
            }
            "count_div" => {
                let n = get_num(0, "count_div")?;
                Ok(CalcValue::Num(count_div(n)))
            }
            "sigma" => {
                let n = get_num(0, "sigma")?;
                Ok(CalcValue::Num(sigma(n)))
            }
            "sieve" => {
                let n = get_num(0, "sieve")?;
                if n > 10_000_000 {
                    self.warning = Some("Warning: n > 10^7 uses significant sieve memory".to_string());
                }
                Ok(CalcValue::Arr(sieve(n)))
            }
            "spf" => {
                let n = get_num(0, "spf")?;
                if n > 10_000_000 {
                    self.warning = Some("Warning: n > 10^7 uses significant SPF memory".to_string());
                }
                Ok(CalcValue::Arr(spf(n)))
            }

            // --- Combinatorics ---
            "fact" => {
                let n = get_num(0, "fact")?;
                if n > 34 {
                    self.warning = Some("Warning: n > 34 overflows i128 without MOD (use fact_mod)".to_string());
                }
                let mut res = 1_i128;
                for i in 2..=n { res = res.wrapping_mul(i); }
                Ok(CalcValue::Num(res))
            }
            "fact_mod" => {
                let n = get_num(0, "fact_mod")?;
                let m = if args.len() >= 2 { get_num(1, "fact_mod")? } else { self.active_mod.unwrap_or(1_000_000_007) };
                let mut res = 1_i128;
                for i in 2..=n { res = (res * i) % m; }
                Ok(CalcValue::Num(res))
            }
            "C" => {
                let n = get_num(0, "C")?;
                let k = get_num(1, "C")?;
                Ok(CalcValue::Num(ncr(n, k)))
            }
            "P" => {
                let n = get_num(0, "P")?;
                let k = get_num(1, "P")?;
                if k < 0 || k > n { return Ok(CalcValue::Num(0)); }
                let mut res = 1_i128;
                for i in 0..k { res = res.wrapping_mul(n - i); }
                Ok(CalcValue::Num(res))
            }
            "C_mod" => {
                let n = get_num(0, "C_mod")?;
                let k = get_num(1, "C_mod")?;
                let m = if args.len() >= 3 { get_num(2, "C_mod")? } else { self.active_mod.unwrap_or(1_000_000_007) };
                Ok(CalcValue::Num(ncr_mod(n, k, m)))
            }
            "catalan" => {
                let n = get_num(0, "catalan")?;
                let c = ncr(2 * n, n) / (n + 1);
                Ok(CalcValue::Num(c))
            }
            "fib" => {
                let n = get_num(0, "fib")?;
                Ok(CalcValue::Num(fib(n)))
            }
            "fib_mod" => {
                let n = get_num(0, "fib_mod")?;
                let m = if args.len() >= 2 { get_num(1, "fib_mod")? } else { self.active_mod.unwrap_or(1_000_000_007) };
                Ok(CalcValue::Num(fib_mod(n, m)))
            }

            // --- Bitwise ---
            "popcount" => {
                let x = get_num(0, "popcount")?;
                Ok(CalcValue::Num(x.count_ones() as i128))
            }
            "msb" => {
                let x = get_num(0, "msb")?;
                if x <= 0 { return Ok(CalcValue::Num(-1)); }
                let mut pos = 0i128;
                let mut temp = x;
                while temp > 1 { temp >>= 1; pos += 1; }
                Ok(CalcValue::Num(pos))
            }
            "lsb" => {
                let x = get_num(0, "lsb")?;
                if x <= 0 { return Ok(CalcValue::Num(-1)); }
                let mut pos = 0i128;
                let mut temp = x;
                while (temp & 1) == 0 { temp >>= 1; pos += 1; }
                Ok(CalcValue::Num(pos))
            }
            "lowbit" => {
                let x = get_num(0, "lowbit")?;
                Ok(CalcValue::Num(x & (-x)))
            }
            "AND" => {
                let a = get_num(0, "AND")?;
                let b = get_num(1, "AND")?;
                Ok(CalcValue::Num(a & b))
            }
            "OR" => {
                let a = get_num(0, "OR")?;
                let b = get_num(1, "OR")?;
                Ok(CalcValue::Num(a | b))
            }
            "XOR" => {
                let a = get_num(0, "XOR")?;
                let b = get_num(1, "XOR")?;
                Ok(CalcValue::Num(a ^ b))
            }
            "NOT" => {
                let x = get_num(0, "NOT")?;
                Ok(CalcValue::Num(!x))
            }
            "SHL" => {
                let x = get_num(0, "SHL")?;
                let k = get_num(1, "SHL")?;
                Ok(CalcValue::Num(x << k))
            }
            "SHR" => {
                let x = get_num(0, "SHR")?;
                let k = get_num(1, "SHR")?;
                Ok(CalcValue::Num(x >> k))
            }
            "submask" => {
                let mask = get_num(0, "submask")?;
                if mask > 2048 {
                    self.warning = Some("Warning: mask > 2048 generates a large submask array".to_string());
                }
                let mut subs = Vec::new();
                let mut s = mask;
                loop {
                    subs.push(s);
                    if s == 0 { break; }
                    s = (s - 1) & mask;
                }
                Ok(CalcValue::Arr(subs))
            }

            // --- Base Conversions ---
            "bin" => {
                let n = get_num(0, "bin")?;
                Ok(CalcValue::Str(format!("0b{:b}", n)))
            }
            "hex" => {
                let n = get_num(0, "hex")?;
                Ok(CalcValue::Str(format!("0x{:X}", n)))
            }
            "oct" => {
                let n = get_num(0, "oct")?;
                Ok(CalcValue::Str(format!("0o{:o}", n)))
            }
            "to_base" => {
                let n = get_num(0, "to_base")?;
                let b = get_num(1, "to_base")? as u32;
                if b < 2 || b > 36 { return Err("Base b must be between 2 and 36".to_string()); }
                Ok(CalcValue::Str(to_base_str(n, b)))
            }
            "from_base" => {
                let s = match &args[0] {
                    CalcValue::Str(st) => st.clone(),
                    CalcValue::Num(n) => n.to_string(),
                    _ => return Err("from_base requires a string for the first argument".to_string()),
                };
                let b = get_num(1, "from_base")? as u32;
                let res = i128::from_str_radix(s.trim_start_matches("0x").trim_start_matches("0b").trim_start_matches("0o"), b)
                    .map_err(|_| format!("String '{}' is invalid for base {}", s, b))?;
                Ok(CalcValue::Num(res))
            }

            // --- Matrix Operations ---
            "identity" => {
                let n = get_num(0, "identity")? as usize;
                if n > 50 { return Err("Matrix dimensions exceeding 50x50 are not supported".to_string()); }
                let mut mat = vec![vec![0i128; n]; n];
                for i in 0..n { mat[i][i] = 1; }
                Ok(CalcValue::Matrix(mat))
            }
            "mat_mul" => {
                let a = match &args[0] { CalcValue::Matrix(m) => m.clone(), _ => return Err("mat_mul requires matrix A for the 1st argument".to_string()) };
                let b = match &args[1] { CalcValue::Matrix(m) => m.clone(), _ => return Err("mat_mul requires matrix B for the 2nd argument".to_string()) };
                let m = if args.len() >= 3 { Some(get_num(2, "mat_mul")?) } else { self.active_mod };
                let res = mat_mul(&a, &b, m)?;
                Ok(CalcValue::Matrix(res))
            }
            "mat_pow" => {
                let a = match &args[0] { CalcValue::Matrix(m) => m.clone(), _ => return Err("mat_pow requires matrix A for the 1st argument".to_string()) };
                let n = get_num(1, "mat_pow")?;
                let m = if args.len() >= 3 { Some(get_num(2, "mat_pow")?) } else { self.active_mod };
                let res = mat_pow(&a, n, m)?;
                Ok(CalcValue::Matrix(res))
            }

            _ => Err(format!("Unsupported function: '{}'", name)),
        }
    }
}

// Math Helper implementations in Rust
fn gcd(mut a: i128, mut b: i128) -> i128 {
    if a < 0 { a = -a; }
    if b < 0 { b = -b; }
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

fn extgcd(a: i128, b: i128) -> (i128, i128, i128) {
    if b == 0 {
        return (a, 1, 0);
    }
    let (g, x1, y1) = extgcd(b, a % b);
    let x = y1;
    let y = x1 - (a / b) * y1;
    (g, x, y)
}

fn mod_pow(base: i128, exp: i128, mod_val: Option<i128>) -> i128 {
    if let Some(m) = mod_val {
        if m <= 0 { return 0; }
        let mut res = 1_i128;
        let mut b = ((base % m) + m) % m;
        let mut e = exp;
        while e > 0 {
            if e & 1 == 1 { res = (res * b) % m; }
            b = (b * b) % m;
            e >>= 1;
        }
        res
    } else {
        let mut res = 1_i128;
        for _ in 0..exp { res = res.wrapping_mul(base); }
        res
    }
}

fn isqrt(n: i128) -> i128 {
    if n <= 0 { return 0; }
    let mut x = (n as f64).sqrt() as i128;
    while (x + 1) * (x + 1) <= n { x += 1; }
    while x * x > n { x -= 1; }
    x
}

fn phi(n_val: i128) -> i128 {
    let mut n = n_val;
    let mut result = n;
    let mut p = 2_i128;
    while p * p <= n {
        if n % p == 0 {
            while n % p == 0 { n /= p; }
            result -= result / p;
        }
        p += 1;
    }
    if n > 1 { result -= result / n; }
    result
}

fn is_prime(n: i128) -> bool {
    if n <= 1 { return false; }
    if n <= 3 { return true; }
    if n % 2 == 0 || n % 3 == 0 { return false; }
    let mut i = 5_i128;
    while i * i <= n {
        if n % i == 0 || n % (i + 2) == 0 { return false; }
        i += 6;
    }
    true
}

fn factorize(n_val: i128) -> String {
    let mut n = n_val;
    if n <= 1 { return n.to_string(); }
    let mut factors: Vec<(i128, u32)> = Vec::new();
    let mut d = 2_i128;
    while d * d <= n {
        if n % d == 0 {
            let mut count = 0;
            while n % d == 0 { count += 1; n /= d; }
            factors.push((d, count));
        }
        d += 1;
    }
    if n > 1 { factors.push((n, 1)); }
    let parts: Vec<String> = factors.iter()
        .map(|(p, c)| if *c > 1 { format!("{}^{}", p, c) } else { p.to_string() })
        .collect();
    parts.join(" × ")
}

fn divisors(n: i128) -> Vec<i128> {
    if n <= 0 { return Vec::new(); }
    let mut list = Vec::new();
    let mut d = 1_i128;
    while d * d <= n {
        if n % d == 0 {
            list.push(d);
            if d * d != n { list.push(n / d); }
        }
        d += 1;
    }
    list.sort();
    list
}

fn count_div(n_val: i128) -> i128 {
    let mut n = n_val;
    let mut count = 1_i128;
    let mut d = 2_i128;
    while d * d <= n {
        if n % d == 0 {
            let mut c = 0_i128;
            while n % d == 0 { c += 1; n /= d; }
            count *= c + 1;
        }
        d += 1;
    }
    if n > 1 { count *= 2; }
    count
}

fn sigma(n_val: i128) -> i128 {
    let mut n = n_val;
    let mut sum = 1_i128;
    let mut d = 2_i128;
    while d * d <= n {
        if n % d == 0 {
            let mut term = 1_i128;
            let mut cur = 1_i128;
            while n % d == 0 { cur *= d; term += cur; n /= d; }
            sum *= term;
        }
        d += 1;
    }
    if n > 1 { sum *= 1 + n; }
    sum
}

fn sieve(n_val: i128) -> Vec<i128> {
    let n = n_val.min(500_000) as usize;
    if n < 2 { return Vec::new(); }
    let mut is_p = vec![true; n + 1];
    is_p[0] = false; is_p[1] = false;
    let mut i = 2;
    while i * i <= n {
        if is_p[i] {
            let mut j = i * i;
            while j <= n { is_p[j] = false; j += i; }
        }
        i += 1;
    }
    let mut primes = Vec::new();
    for p in 2..=n { if is_p[p] { primes.push(p as i128); } }
    primes
}

fn spf(n_val: i128) -> Vec<i128> {
    let n = n_val.min(100_000) as usize;
    let mut min_p: Vec<i128> = (0..=n as i128).collect();
    let mut i = 2;
    while i * i <= n {
        if min_p[i] == i as i128 {
            let mut j = i * i;
            while j <= n {
                if min_p[j] == j as i128 { min_p[j] = i as i128; }
                j += i;
            }
        }
        i += 1;
    }
    min_p
}

fn ncr(n: i128, k: i128) -> i128 {
    if k < 0 || k > n { return 0; }
    if k == 0 || k == n { return 1; }
    let mut kk = k;
    if kk > n - kk { kk = n - kk; }
    let mut res = 1_i128;
    for i in 1..=kk {
        res = res * (n - i + 1) / i;
    }
    res
}

fn ncr_mod(n: i128, k: i128, m: i128) -> i128 {
    if k < 0 || k > n { return 0; }
    let mut num = 1_i128;
    let mut den = 1_i128;
    let mut kk = k;
    if kk > n - kk { kk = n - kk; }
    for i in 1..=kk {
        num = (num * (n - i + 1)) % m;
        den = (den * i) % m;
    }
    (num * mod_pow(den, m - 2, Some(m))) % m
}

fn fib(n: i128) -> i128 {
    if n <= 0 { return 0; }
    let mut a = 0_i128;
    let mut b = 1_i128;
    for _ in 0..n {
        let c = a.wrapping_add(b);
        a = b; b = c;
    }
    a
}

fn fib_mod(n: i128, m: i128) -> i128 {
    if n <= 0 { return 0; }
    let mat = vec![vec![1, 1], vec![1, 0]];
    let res = mat_pow(&mat, n, Some(m));
    match res {
        Ok(m_res) => m_res[0][1],
        Err(_) => 0,
    }
}

fn to_base_str(n_val: i128, b: u32) -> String {
    if n_val == 0 { return "0".to_string(); }
    let mut n = n_val.abs();
    let chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".as_bytes();
    let mut digits = Vec::new();
    while n > 0 {
        let rem = (n % (b as i128)) as usize;
        digits.push(chars[rem] as char);
        n /= b as i128;
    }
    if n_val < 0 { digits.push('-'); }
    digits.into_iter().rev().collect()
}

fn mat_mul(a: &[Vec<i128>], b: &[Vec<i128>], mod_val: Option<i128>) -> Result<Vec<Vec<i128>>, String> {
    let r1 = a.len();
    let c1 = a.first().map(|r| r.len()).unwrap_or(0);
    let r2 = b.len();
    let c2 = b.first().map(|r| r.len()).unwrap_or(0);

    if c1 != r2 {
        return Err(format!("Cannot multiply matrix {}×{} with matrix {}×{}", r1, c1, r2, c2));
    }

    let mut res = vec![vec![0i128; c2]; r1];
    for i in 0..r1 {
        for k in 0..c1 {
            for j in 0..c2 {
                let term = a[i][k].wrapping_mul(b[k][j]);
                res[i][j] = res[i][j].wrapping_add(term);
                if let Some(m) = mod_val {
                    res[i][j] = ((res[i][j] % m) + m) % m;
                }
            }
        }
    }
    Ok(res)
}

fn mat_pow(a: &[Vec<i128>], exp: i128, mod_val: Option<i128>) -> Result<Vec<Vec<i128>>, String> {
    let n = a.len();
    if n == 0 || a[0].len() != n {
        return Err("Matrix exponentiation requires a square matrix".to_string());
    }

    let mut res = vec![vec![0i128; n]; n];
    for i in 0..n { res[i][i] = 1; }
    let mut base = a.to_vec();
    let mut e = exp;

    while e > 0 {
        if e & 1 == 1 {
            res = mat_mul(&res, &base, mod_val)?;
        }
        base = mat_mul(&base, &base, mod_val)?;
        e >>= 1;
    }
    Ok(res)
}

#[derive(Debug, PartialEq, Clone)]
enum Token {
    Num(i128),
    StrLit(String),
    Ident(String),
    Op(String),
    LParen,
    RParen,
    LBracket,
    RBracket,
    Comma,
}

fn tokenize(s: &str) -> Result<Vec<Token>, String> {
    let mut tokens = Vec::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];
        if c.is_whitespace() {
            i += 1;
            continue;
        }

        if c == '\'' || c == '"' {
            let quote = c;
            i += 1;
            let start = i;
            while i < chars.len() && chars[i] != quote {
                i += 1;
            }
            let str_val: String = chars[start..i].iter().collect();
            if i < chars.len() { i += 1; }
            tokens.push(Token::StrLit(str_val));
            continue;
        }

        if c.is_digit(10) || (c == '0' && i + 1 < chars.len() && matches!(chars[i+1], 'x'|'b'|'o'|'X'|'B'|'O')) {
            let start = i;
            if chars[i] == '0' && i + 1 < chars.len() && matches!(chars[i+1], 'x'|'b'|'o'|'X'|'B'|'O') {
                i += 2;
                while i < chars.len() && chars[i].is_alphanumeric() { i += 1; }
            } else {
                while i < chars.len() && chars[i].is_digit(10) { i += 1; }
            }
            let num_str: String = chars[start..i].iter().collect();
            let num = parse_i128(&num_str).ok_or_else(|| format!("Invalid number: {}", num_str))?;
            tokens.push(Token::Num(num));
            continue;
        }

        if c.is_alphabetic() || c == '_' {
            let start = i;
            while i < chars.len() && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let ident: String = chars[start..i].iter().collect();
            if matches!(ident.as_str(), "AND" | "OR" | "XOR" | "MOD" | "SHL" | "SHR" | "NOT") {
                tokens.push(Token::Op(ident));
            } else {
                tokens.push(Token::Ident(ident));
            }
            continue;
        }

        match c {
            '(' => { tokens.push(Token::LParen); i += 1; }
            ')' => { tokens.push(Token::RParen); i += 1; }
            '[' => { tokens.push(Token::LBracket); i += 1; }
            ']' => { tokens.push(Token::RBracket); i += 1; }
            ',' => { tokens.push(Token::Comma); i += 1; }
            '<' => {
                if i + 1 < chars.len() && chars[i + 1] == '<' {
                    tokens.push(Token::Op("<<".to_string()));
                    i += 2;
                } else {
                    tokens.push(Token::Op("<".to_string()));
                    i += 1;
                }
            }
            '>' => {
                if i + 1 < chars.len() && chars[i + 1] == '>' {
                    tokens.push(Token::Op(">>".to_string()));
                    i += 2;
                } else {
                    tokens.push(Token::Op(">".to_string()));
                    i += 1;
                }
            }
            '*' => {
                if i + 1 < chars.len() && chars[i + 1] == '*' {
                    tokens.push(Token::Op("**".to_string()));
                    i += 2;
                } else {
                    tokens.push(Token::Op("*".to_string()));
                    i += 1;
                }
            }
            '+' | '-' | '/' | '%' | '^' | '&' | '|' | '~' => {
                tokens.push(Token::Op(c.to_string()));
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }
    Ok(tokens)
}
