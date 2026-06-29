// src-tauri/src/commands/calculator.rs

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use crate::errors::ZetaError;
use num_bigint::BigInt;
use num_traits::{Zero, One, Signed, ToPrimitive, Num};

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
    Num(BigInt),
    Ratio(BigInt, BigInt), // simplified: den > 1, gcd(num, den) == 1
    Str(String),
    Arr(Vec<CalcValue>),
    Matrix(Vec<Vec<BigInt>>),
}

impl CalcValue {
    pub fn to_display_string(&self) -> String {
        match self {
            CalcValue::Num(n) => n.to_string(),
            CalcValue::Ratio(num, den) => divide_to_decimal(num, den),
            CalcValue::Str(s) => s.clone(),
            CalcValue::Arr(arr) => format!("[{}]", arr.iter().map(|v| v.to_display_string()).collect::<Vec<_>>().join(", ")),
            CalcValue::Matrix(mat) => {
                let rows: Vec<String> = mat.iter()
                    .map(|row| format!("[{}]", row.iter().map(|v| v.to_string()).collect::<Vec<_>>().join(",")))
                    .collect();
                format!("[{}]", rows.join(","))
            }
        }
    }

    pub fn as_bigint(&self) -> Result<BigInt, String> {
        match self {
            CalcValue::Num(n) => Ok(n.clone()),
            CalcValue::Ratio(num, den) => Ok(num / den),
            CalcValue::Str(s) => parse_bigint(s).ok_or_else(|| format!("Cannot convert '{}' to integer", s)),
            _ => Err("Array or Matrix value cannot be directly converted to an integer".to_string()),
        }
    }
}

fn divide_to_decimal(num: &BigInt, den: &BigInt) -> String {
    if den.is_zero() {
        return "Error: Division by zero".to_string();
    }
    let is_neg = (num.is_negative() ^ den.is_negative()) && !num.is_zero();
    let n = num.abs();
    let d = den.abs();

    let int_part = &n / &d;
    let rem = &n % &d;

    if rem.is_zero() {
        let prefix = if is_neg { "-" } else { "" };
        return format!("{}{}", prefix, int_part);
    }

    let mut decimals = String::new();
    let mut map: HashMap<BigInt, usize> = HashMap::new();
    let mut cur_rem = rem;

    let max_digits = 500; // Cap search for repeating period
    let mut repeating_start: Option<usize> = None;

    while !cur_rem.is_zero() && decimals.len() < max_digits {
        if let Some(&pos) = map.get(&cur_rem) {
            repeating_start = Some(pos);
            break;
        }
        map.insert(cur_rem.clone(), decimals.len());
        cur_rem *= 10;
        let digit = &cur_rem / &d;
        cur_rem %= &d;
        decimals.push_str(&digit.to_string());
    }

    let prefix = if is_neg { "-" } else { "" };
    if let Some(start) = repeating_start {
        let non_rep = &decimals[..start];
        let rep = &decimals[start..];
        format!("{}{}.{}({})", prefix, int_part, non_rep, rep)
    } else if cur_rem.is_zero() {
        format!("{}{}.{}", prefix, int_part, decimals)
    } else {
        format!("{}{}.{}...", prefix, int_part, decimals)
    }
}

fn make_ratio(num: BigInt, den: BigInt) -> CalcValue {
    if den.is_zero() {
        return CalcValue::Str("Error: Division by zero".to_string());
    }
    if num.is_zero() {
        return CalcValue::Num(BigInt::zero());
    }
    let is_neg = num.is_negative() ^ den.is_negative();
    let n = num.abs();
    let d = den.abs();
    let g = bigint_gcd(n.clone(), d.clone());
    let sn = if is_neg { -(&n / &g) } else { &n / &g };
    let sd = &d / &g;
    if sd.is_one() {
        CalcValue::Num(sn)
    } else {
        CalcValue::Ratio(sn, sd)
    }
}

fn add_val(a: CalcValue, b: CalcValue) -> Result<CalcValue, String> {
    match (a, b) {
        (CalcValue::Num(n1), CalcValue::Num(n2)) => Ok(CalcValue::Num(n1 + n2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Num(n2)) => Ok(make_ratio(n1 + n2 * &d1, d1)),
        (CalcValue::Num(n1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * &d2 + n2, d2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * &d2 + n2 * &d1, d1 * d2)),
        (v1, v2) => Ok(CalcValue::Num(v1.as_bigint()? + v2.as_bigint()?)),
    }
}

fn sub_val(a: CalcValue, b: CalcValue) -> Result<CalcValue, String> {
    match (a, b) {
        (CalcValue::Num(n1), CalcValue::Num(n2)) => Ok(CalcValue::Num(n1 - n2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Num(n2)) => Ok(make_ratio(n1 - n2 * &d1, d1)),
        (CalcValue::Num(n1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * &d2 - n2, d2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * &d2 - n2 * &d1, d1 * d2)),
        (v1, v2) => Ok(CalcValue::Num(v1.as_bigint()? - v2.as_bigint()?)),
    }
}

fn mul_val(a: CalcValue, b: CalcValue) -> Result<CalcValue, String> {
    match (a, b) {
        (CalcValue::Num(n1), CalcValue::Num(n2)) => Ok(CalcValue::Num(n1 * n2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Num(n2)) => Ok(make_ratio(n1 * n2, d1)),
        (CalcValue::Num(n1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * n2, d2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * n2, d1 * d2)),
        (v1, v2) => Ok(CalcValue::Num(v1.as_bigint()? * v2.as_bigint()?)),
    }
}

fn div_val(a: CalcValue, b: CalcValue) -> Result<CalcValue, String> {
    match (a, b) {
        (CalcValue::Num(n1), CalcValue::Num(n2)) => Ok(make_ratio(n1, n2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Num(n2)) => Ok(make_ratio(n1, d1 * n2)),
        (CalcValue::Num(n1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * d2, n2)),
        (CalcValue::Ratio(n1, d1), CalcValue::Ratio(n2, d2)) => Ok(make_ratio(n1 * d2, d1 * n2)),
        (v1, v2) => Ok(make_ratio(v1.as_bigint()?, v2.as_bigint()?)),
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
    let ans_num = ans_val.and_then(|a| parse_bigint(&a)).unwrap_or_else(BigInt::zero);

    let mut evaluator = CpEvaluator::new(active_mod, ans_num, &current_vars);
    let eval_res = evaluator.evaluate(eval_target);
    let warning = evaluator.warning.clone();

    match eval_res {
        Ok(val) => {
            let res_str = val.to_display_string();

            if let Some(var_name) = target_var {
                current_vars.insert(var_name.clone(), res_str.clone());
            }

            let mut info = None;
            let mut display_res = res_str.clone();

            match &val {
                CalcValue::Num(_) | CalcValue::Ratio(_, _) => {
                    if res_str.len() > 30 {
                        info = Some(format!("[{} digits/chars]", res_str.len()));
                        let prefix = &res_str[..14];
                        let suffix = &res_str[res_str.len() - 8..];
                        display_res = format!("{} … {}", prefix, suffix);
                    }
                }
                CalcValue::Arr(arr) => {
                    if arr.len() > 15 {
                        info = Some(format!("[{} elements]", arr.len()));
                        let preview: Vec<String> = arr.iter().take(5).map(|v| v.to_display_string()).collect();
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

fn parse_mod_str(s: &str) -> Option<BigInt> {
    match s {
        "1e9+7" => Some(BigInt::from(1_000_000_007i64)),
        "998244353" => Some(BigInt::from(998_244_353i64)),
        "1e9+9" => Some(BigInt::from(1_000_000_009i64)),
        _ => parse_bigint(s),
    }
}

fn parse_bigint(s: &str) -> Option<BigInt> {
    let clean = s.trim();
    if clean.starts_with("0x") || clean.starts_with("0X") {
        BigInt::from_str_radix(&clean[2..], 16).ok()
    } else if clean.starts_with("0b") || clean.starts_with("0B") {
        BigInt::from_str_radix(&clean[2..], 2).ok()
    } else if clean.starts_with("0o") || clean.starts_with("0O") {
        BigInt::from_str_radix(&clean[2..], 8).ok()
    } else {
        clean.parse::<BigInt>().ok()
    }
}

struct CpEvaluator<'a> {
    active_mod: Option<BigInt>,
    ans_val: BigInt,
    vars: &'a HashMap<String, String>,
    pub warning: Option<String>,
}

impl<'a> CpEvaluator<'a> {
    fn new(active_mod: Option<BigInt>, ans_val: BigInt, vars: &'a HashMap<String, String>) -> Self {
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
                    left = CalcValue::Num(left.as_bigint()? | right.as_bigint()?);
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
                    left = CalcValue::Num(left.as_bigint()? ^ right.as_bigint()?);
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
                    left = CalcValue::Num(left.as_bigint()? & right.as_bigint()?);
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
                    let shift_amount = right.as_bigint()?.to_usize().unwrap_or(0);
                    left = CalcValue::Num(left.as_bigint()? << shift_amount);
                    continue;
                } else if op == ">>" || op == "SHR" {
                    *pos += 1;
                    let right = self.parse_add_sub(tokens, pos)?;
                    let shift_amount = right.as_bigint()?.to_usize().unwrap_or(0);
                    left = CalcValue::Num(left.as_bigint()? >> shift_amount);
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
                    left = add_val(left, right)?;
                    continue;
                } else if op == "-" {
                    *pos += 1;
                    let right = self.parse_mul_div(tokens, pos)?;
                    left = sub_val(left, right)?;
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
                    left = mul_val(left, right)?;
                    continue;
                } else if op == "/" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    left = div_val(left, right)?;
                    continue;
                } else if op == "%" || op == "MOD" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    let r_num = right.as_bigint()?;
                    if r_num.is_zero() { return Err("Modulo by zero error".to_string()); }
                    left = CalcValue::Num(left.as_bigint()? % r_num);
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
                if op == "**" {
                    *pos += 1;
                    let right = self.parse_pow(tokens, pos)?;
                    let mod_val = self.active_mod.clone();
                    let res = bigint_pow(&left.as_bigint()?, &right.as_bigint()?, mod_val);
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
                Ok(CalcValue::Num(n.clone()))
            }
            Token::StrLit(s) => {
                *pos += 1;
                Ok(CalcValue::Str(s.clone()))
            }
            Token::Ident(id) => {
                let name = id.clone();
                *pos += 1;

                if *pos < tokens.len() && tokens[*pos] == Token::LParen {
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
                    if name == "ans" {
                        Ok(CalcValue::Num(self.ans_val.clone()))
                    } else if name == "M" {
                        Ok(CalcValue::Num(self.active_mod.clone().unwrap_or_else(|| BigInt::from(1_000_000_007i64))))
                    } else if let Some(val_str) = self.vars.get(&name) {
                        if let Some(n) = parse_bigint(val_str) {
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
                            let mut row = Vec::new();
                            for item in arr {
                                row.push(item.as_bigint()?);
                            }
                            mat.push(row);
                        }
                    }
                    Ok(CalcValue::Matrix(mat))
                } else {
                    Ok(CalcValue::Arr(elements))
                }
            }
            Token::Op(op) if op == "-" => {
                *pos += 1;
                let val = self.parse_primary(tokens, pos)?;
                Ok(CalcValue::Num(-val.as_bigint()?))
            }
            Token::Op(op) if op == "+" => {
                *pos += 1;
                self.parse_primary(tokens, pos)
            }
            Token::Op(op) if op == "~" || op == "NOT" => {
                *pos += 1;
                let val = self.parse_primary(tokens, pos)?;
                Ok(CalcValue::Num(!val.as_bigint()?))
            }
            _ => Err(format!("Invalid syntax at: '{:?}'", tokens[*pos])),
        }
    }

    fn eval_func(&mut self, name: &str, args: &[CalcValue]) -> Result<CalcValue, String> {
        let get_num = |idx: usize, func_name: &str| -> Result<BigInt, String> {
            args.get(idx)
                .ok_or_else(|| format!("Function {} requires at least {} arguments", func_name, idx + 1))?
                .as_bigint()
        };

        match name {
            "gcd" => {
                let a = get_num(0, "gcd")?;
                let b = get_num(1, "gcd")?;
                Ok(CalcValue::Num(bigint_gcd(a, b)))
            }
            "lcm" => {
                let a = get_num(0, "lcm")?;
                let b = get_num(1, "lcm")?;
                let g = bigint_gcd(a.clone(), b.clone());
                if g.is_zero() { Ok(CalcValue::Num(BigInt::zero())) } else { Ok(CalcValue::Num((a / g) * b)) }
            }
            "pow" => {
                let a = get_num(0, "pow")?;
                let b = get_num(1, "pow")?;
                let m = if args.len() >= 3 { Some(get_num(2, "pow")?) } else { None };
                Ok(CalcValue::Num(bigint_pow(&a, &b, m)))
            }
            "pow_mod" => {
                let a = get_num(0, "pow_mod")?;
                let b = get_num(1, "pow_mod")?;
                let m = if args.len() >= 3 { Some(get_num(2, "pow_mod")?) } else { self.active_mod.clone() };
                Ok(CalcValue::Num(bigint_pow(&a, &b, m)))
            }
            "phi" => {
                let n = get_num(0, "phi")?;
                Ok(CalcValue::Num(bigint_phi(n)))
            }
            "extgcd" => {
                let a = get_num(0, "extgcd")?;
                let b = get_num(1, "extgcd")?;
                let (g, x, y) = bigint_extgcd(a, b);
                Ok(CalcValue::Str(format!("g={}, x={}, y={}", g, x, y)))
            }
            "modinv" => {
                let a = get_num(0, "modinv")?;
                let m = if args.len() >= 2 { get_num(1, "modinv")? } else { self.active_mod.clone().unwrap_or_else(|| BigInt::from(1_000_000_007i64)) };
                let (g, x, _) = bigint_extgcd(a.clone(), m.clone());
                if !g.is_one() {
                    Err(format!("Modular inverse does not exist (gcd({}, {}) = {})", a, m, g))
                } else {
                    Ok(CalcValue::Num(((x % &m) + &m) % m))
                }
            }
            "sqrt" => {
                let n = get_num(0, "sqrt")?;
                if n.is_negative() { return Err("Square root of negative number is invalid for integers".to_string()); }
                Ok(CalcValue::Num(n.sqrt()))
            }
            "ilog2" => {
                let n = get_num(0, "ilog2")?;
                if !n.is_positive() { return Err("ilog2(n) requires n > 0".to_string()); }
                let bits = n.bits();
                Ok(CalcValue::Num(BigInt::from(if bits > 0 { bits - 1 } else { 0 })))
            }
            "is_prime" => {
                let n = get_num(0, "is_prime")?;
                if n > BigInt::from(1_000_000_000_000i64) {
                    self.warning = Some(format!("Warning: n={} is large for prime check (O(√n) trial division)", n));
                }
                Ok(CalcValue::Str(if bigint_is_prime(&n) { "true".to_string() } else { "false".to_string() }))
            }
            "factorize" => {
                let n = get_num(0, "factorize")?;
                if n > BigInt::from(1_000_000_000_000i64) {
                    self.warning = Some("Warning: n is large for prime factorization (O(√n))".to_string());
                }
                Ok(CalcValue::Str(bigint_factorize(n)))
            }
            "divisors" => {
                let n = get_num(0, "divisors")?;
                if n > BigInt::from(1_000_000_000_000i64) {
                    self.warning = Some("Warning: n is large for listing divisors (O(√n))".to_string());
                }
                Ok(CalcValue::Arr(bigint_divisors(n).into_iter().map(CalcValue::Num).collect()))
            }
            "count_div" => {
                let n = get_num(0, "count_div")?;
                Ok(CalcValue::Num(bigint_count_div(n)))
            }
            "sigma" => {
                let n = get_num(0, "sigma")?;
                Ok(CalcValue::Num(bigint_sigma(n)))
            }
            "sieve" => {
                let n = get_num(0, "sieve")?;
                if n > BigInt::from(10_000_000i64) {
                    self.warning = Some("Warning: n > 10^7 uses significant sieve memory".to_string());
                }
                Ok(CalcValue::Arr(bigint_sieve(n).into_iter().map(CalcValue::Num).collect()))
            }
            "spf" => {
                let n = get_num(0, "spf")?;
                if n > BigInt::from(10_000_000i64) {
                    self.warning = Some("Warning: n > 10^7 uses significant SPF memory".to_string());
                }
                Ok(CalcValue::Arr(bigint_spf(n).into_iter().map(CalcValue::Num).collect()))
            }

            "fact" => {
                let n = get_num(0, "fact")?;
                Ok(CalcValue::Num(bigint_fact(&n)))
            }
            "fact_mod" => {
                let n = get_num(0, "fact_mod")?;
                let m = if args.len() >= 2 { get_num(1, "fact_mod")? } else { self.active_mod.clone().unwrap_or_else(|| BigInt::from(1_000_000_007i64)) };
                Ok(CalcValue::Num(bigint_fact_mod(&n, &m)))
            }
            "C" => {
                let n = get_num(0, "C")?;
                let k = get_num(1, "C")?;
                Ok(CalcValue::Num(bigint_ncr(&n, &k)))
            }
            "P" => {
                let n = get_num(0, "P")?;
                let k = get_num(1, "P")?;
                Ok(CalcValue::Num(bigint_npr(&n, &k)))
            }
            "C_mod" => {
                let n = get_num(0, "C_mod")?;
                let k = get_num(1, "C_mod")?;
                let m = if args.len() >= 3 { get_num(2, "C_mod")? } else { self.active_mod.clone().unwrap_or_else(|| BigInt::from(1_000_000_007i64)) };
                Ok(CalcValue::Num(bigint_ncr_mod(&n, &k, &m)))
            }
            "catalan" => {
                let n = get_num(0, "catalan")?;
                let c = bigint_ncr(&(BigInt::from(2i64) * &n), &n) / (&n + BigInt::one());
                Ok(CalcValue::Num(c))
            }
            "fib" => {
                let n = get_num(0, "fib")?;
                Ok(CalcValue::Num(bigint_fib(&n)))
            }
            "fib_mod" => {
                let n = get_num(0, "fib_mod")?;
                let m = if args.len() >= 2 { get_num(1, "fib_mod")? } else { self.active_mod.clone().unwrap_or_else(|| BigInt::from(1_000_000_007i64)) };
                Ok(CalcValue::Num(bigint_fib_mod(&n, &m)))
            }

            "popcount" => {
                let x = get_num(0, "popcount")?;
                let mut count = 0u64;
                for digit in x.to_u64_digits().1 {
                    count += digit.count_ones() as u64;
                }
                Ok(CalcValue::Num(BigInt::from(count)))
            }
            "msb" => {
                let x = get_num(0, "msb")?;
                if !x.is_positive() { return Ok(CalcValue::Num(BigInt::from(-1i64))); }
                Ok(CalcValue::Num(BigInt::from(x.bits() - 1)))
            }
            "lsb" => {
                let x = get_num(0, "lsb")?;
                if x.is_zero() { return Ok(CalcValue::Num(BigInt::from(-1i64))); }
                let mut pos = 0u64;
                let mut temp = x;
                while (&temp & BigInt::one()).is_zero() {
                    temp >>= 1;
                    pos += 1;
                }
                Ok(CalcValue::Num(BigInt::from(pos)))
            }
            "lowbit" => {
                let x = get_num(0, "lowbit")?;
                Ok(CalcValue::Num(&x & (-&x)))
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
                let k = get_num(1, "SHL")?.to_usize().unwrap_or(0);
                Ok(CalcValue::Num(x << k))
            }
            "SHR" => {
                let x = get_num(0, "SHR")?;
                let k = get_num(1, "SHR")?.to_usize().unwrap_or(0);
                Ok(CalcValue::Num(x >> k))
            }
            "submask" => {
                let mask = get_num(0, "submask")?;
                let mut subs = Vec::new();
                let mut s = mask.clone();
                let limit = 2048;
                let mut count = 0;
                loop {
                    subs.push(CalcValue::Num(s.clone()));
                    if s.is_zero() { break; }
                    s = (&s - BigInt::one()) & &mask;
                    count += 1;
                    if count >= limit { break; }
                }
                Ok(CalcValue::Arr(subs))
            }

            "bin" => {
                let n = get_num(0, "bin")?;
                Ok(CalcValue::Str(format!("0b{}", n.to_str_radix(2))))
            }
            "hex" => {
                let n = get_num(0, "hex")?;
                Ok(CalcValue::Str(format!("0x{}", n.to_str_radix(16).to_uppercase())))
            }
            "oct" => {
                let n = get_num(0, "oct")?;
                Ok(CalcValue::Str(format!("0o{}", n.to_str_radix(8))))
            }
            "to_base" => {
                let n = get_num(0, "to_base")?;
                let b = get_num(1, "to_base")?.to_u32().unwrap_or(10);
                if b < 2 || b > 36 { return Err("Base b must be between 2 and 36".to_string()); }
                Ok(CalcValue::Str(n.to_str_radix(b)))
            }
            "from_base" => {
                let s = match &args[0] {
                    CalcValue::Str(st) => st.clone(),
                    CalcValue::Num(n) => n.to_string(),
                    _ => return Err("from_base requires a string for the first argument".to_string()),
                };
                let b = get_num(1, "from_base")?.to_u32().unwrap_or(10);
                let clean_s = s.trim_start_matches("0x").trim_start_matches("0b").trim_start_matches("0o");
                let res = BigInt::from_str_radix(clean_s, b)
                    .map_err(|_| format!("String '{}' is invalid for base {}", s, b))?;
                Ok(CalcValue::Num(res))
            }

            "identity" => {
                let n = get_num(0, "identity")?.to_usize().unwrap_or(0);
                if n > 50 { return Err("Matrix dimensions exceeding 50x50 are not supported".to_string()); }
                let mut mat = vec![vec![BigInt::zero(); n]; n];
                for i in 0..n { mat[i][i] = BigInt::one(); }
                Ok(CalcValue::Matrix(mat))
            }
            "mat_mul" => {
                let a = match &args[0] { CalcValue::Matrix(m) => m.clone(), _ => return Err("mat_mul requires matrix A for the 1st argument".to_string()) };
                let b = match &args[1] { CalcValue::Matrix(m) => m.clone(), _ => return Err("mat_mul requires matrix B for the 2nd argument".to_string()) };
                let m = if args.len() >= 3 { Some(get_num(2, "mat_mul")?) } else { self.active_mod.clone() };
                let res = bigint_mat_mul(&a, &b, m)?;
                Ok(CalcValue::Matrix(res))
            }
            "mat_pow" => {
                let a = match &args[0] { CalcValue::Matrix(m) => m.clone(), _ => return Err("mat_pow requires matrix A for the 1st argument".to_string()) };
                let n = get_num(1, "mat_pow")?;
                let m = if args.len() >= 3 { Some(get_num(2, "mat_pow")?) } else { self.active_mod.clone() };
                let res = bigint_mat_pow(&a, &n, m)?;
                Ok(CalcValue::Matrix(res))
            }

            _ => Err(format!("Unsupported function: '{}'", name)),
        }
    }
}

fn bigint_gcd(mut a: BigInt, mut b: BigInt) -> BigInt {
    if a.is_negative() { a = -a; }
    if b.is_negative() { b = -b; }
    while !b.is_zero() {
        let t = b.clone();
        b = a % &b;
        a = t;
    }
    a
}

fn bigint_extgcd(a: BigInt, b: BigInt) -> (BigInt, BigInt, BigInt) {
    if b.is_zero() {
        return (a, BigInt::one(), BigInt::zero());
    }
    let (g, x1, y1) = bigint_extgcd(b.clone(), &a % &b);
    let x = y1.clone();
    let y = x1 - (&a / &b) * y1;
    (g, x, y)
}

fn bigint_pow(base: &BigInt, exp: &BigInt, mod_val: Option<BigInt>) -> BigInt {
    if exp.is_negative() { return BigInt::zero(); }
    if let Some(ref m) = mod_val {
        if m.is_zero() { return BigInt::zero(); }
        let mut res = BigInt::one();
        let mut b = ((base % m) + m) % m;
        let mut e = exp.clone();
        while !e.is_zero() {
            if (&e & BigInt::one()).is_one() { res = (res * &b) % m; }
            b = (&b * &b) % m;
            e >>= 1;
        }
        res
    } else {
        let mut res = BigInt::one();
        let mut b = base.clone();
        let mut e = exp.clone();
        while !e.is_zero() {
            if (&e & BigInt::one()).is_one() { res = res * &b; }
            b = &b * &b;
            e >>= 1;
        }
        res
    }
}

fn bigint_phi(n_val: BigInt) -> BigInt {
    let mut n = n_val.clone();
    let mut result = n_val.clone();
    let mut p = BigInt::from(2i64);
    while &p * &p <= n {
        if (&n % &p).is_zero() {
            while (&n % &p).is_zero() { n /= &p; }
            result -= &result / &p;
        }
        p += 1;
    }
    if n > BigInt::one() { result -= &result / &n; }
    result
}

fn bigint_is_prime(n: &BigInt) -> bool {
    if n <= &BigInt::one() { return false; }
    if n <= &BigInt::from(3i64) { return true; }
    if (n % 2i32).is_zero() || (n % 3i32).is_zero() { return false; }
    let mut i = BigInt::from(5i64);
    while &i * &i <= *n {
        if (n % &i).is_zero() || (n % (&i + 2i32)).is_zero() { return false; }
        i += 6i32;
    }
    true
}

fn bigint_factorize(n_val: BigInt) -> String {
    let mut n = n_val.clone();
    if n <= BigInt::one() { return n.to_string(); }
    let mut factors: Vec<(BigInt, u32)> = Vec::new();
    let mut d = BigInt::from(2i64);
    while &d * &d <= n {
        if (&n % &d).is_zero() {
            let mut count = 0;
            while (&n % &d).is_zero() { count += 1; n /= &d; }
            factors.push((d.clone(), count));
        }
        d += 1;
    }
    if n > BigInt::one() { factors.push((n, 1)); }
    let parts: Vec<String> = factors.iter()
        .map(|(p, c)| if *c > 1 { format!("{}^{}", p, c) } else { p.to_string() })
        .collect();
    parts.join(" × ")
}

fn bigint_divisors(n: BigInt) -> Vec<BigInt> {
    if !n.is_positive() { return Vec::new(); }
    let mut list = Vec::new();
    let mut d = BigInt::one();
    while &d * &d <= n {
        if (&n % &d).is_zero() {
            list.push(d.clone());
            let div = &n / &d;
            if div != d { list.push(div); }
        }
        d += 1;
    }
    list.sort();
    list
}

fn bigint_count_div(n_val: BigInt) -> BigInt {
    let mut n = n_val.clone();
    let mut count = BigInt::one();
    let mut d = BigInt::from(2i64);
    while &d * &d <= n {
        if (&n % &d).is_zero() {
            let mut c = BigInt::zero();
            while (&n % &d).is_zero() { c += 1; n /= &d; }
            count *= c + 1;
        }
        d += 1;
    }
    if n > BigInt::one() { count *= 2; }
    count
}

fn bigint_sigma(n_val: BigInt) -> BigInt {
    let mut n = n_val.clone();
    let mut sum = BigInt::one();
    let mut d = BigInt::from(2i64);
    while &d * &d <= n {
        if (&n % &d).is_zero() {
            let mut term = BigInt::one();
            let mut cur = BigInt::one();
            while (&n % &d).is_zero() { cur *= &d; term += &cur; n /= &d; }
            sum *= term;
        }
        d += 1;
    }
    if n > BigInt::one() { sum *= BigInt::one() + n; }
    sum
}

fn bigint_sieve(n_val: BigInt) -> Vec<BigInt> {
    let n = n_val.to_usize().unwrap_or(500000).min(500000);
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
    for p in 2..=n { if is_p[p] { primes.push(BigInt::from(p)); } }
    primes
}

fn bigint_spf(n_val: BigInt) -> Vec<BigInt> {
    let n = n_val.to_usize().unwrap_or(100000).min(100000);
    let mut min_p: Vec<BigInt> = (0..=n).map(BigInt::from).collect();
    let mut i = 2;
    while i * i <= n {
        if min_p[i] == BigInt::from(i) {
            let mut j = i * i;
            while j <= n {
                if min_p[j] == BigInt::from(j) { min_p[j] = BigInt::from(i); }
                j += i;
            }
        }
        i += 1;
    }
    min_p
}

fn bigint_fact(n: &BigInt) -> BigInt {
    let mut res = BigInt::one();
    let mut i = BigInt::from(2i64);
    while &i <= n {
        res *= &i;
        i += 1;
    }
    res
}

fn bigint_fact_mod(n: &BigInt, m: &BigInt) -> BigInt {
    let mut res = BigInt::one();
    let mut i = BigInt::from(2i64);
    while &i <= n {
        res = (res * &i) % m;
        i += 1;
    }
    res
}

fn bigint_ncr(n: &BigInt, k: &BigInt) -> BigInt {
    if k.is_negative() || k > n { return BigInt::zero(); }
    if k.is_zero() || k == n { return BigInt::one(); }
    let mut kk = k.clone();
    if &kk > &(n - &kk) { kk = n - &kk; }
    let mut res = BigInt::one();
    let mut i = BigInt::one();
    while &i <= &kk {
        res = res * (n - &i + BigInt::one()) / &i;
        i += 1;
    }
    res
}

fn bigint_npr(n: &BigInt, k: &BigInt) -> BigInt {
    if k.is_negative() || k > n { return BigInt::zero(); }
    let mut res = BigInt::one();
    let mut i = BigInt::zero();
    while &i < k {
        res *= n - &i;
        i += 1;
    }
    res
}

fn bigint_ncr_mod(n: &BigInt, k: &BigInt, m: &BigInt) -> BigInt {
    if k.is_negative() || k > n { return BigInt::zero(); }
    let mut num = BigInt::one();
    let mut den = BigInt::one();
    let mut kk = k.clone();
    if &kk > &(n - &kk) { kk = n - &kk; }
    let mut i = BigInt::one();
    while &i <= &kk {
        num = (num * (n - &i + BigInt::one())) % m;
        den = (den * &i) % m;
        i += 1;
    }
    (num * bigint_pow(&den, &(m - BigInt::from(2i64)), Some(m.clone()))) % m
}

fn bigint_fib(n: &BigInt) -> BigInt {
    if !n.is_positive() { return BigInt::zero(); }
    let mut a = BigInt::zero();
    let mut b = BigInt::one();
    let mut i = BigInt::zero();
    while &i < n {
        let c = &a + &b;
        a = b; b = c;
        i += 1;
    }
    a
}

fn bigint_fib_mod(n: &BigInt, m: &BigInt) -> BigInt {
    if !n.is_positive() { return BigInt::zero(); }
    let mat = vec![vec![BigInt::one(), BigInt::one()], vec![BigInt::one(), BigInt::zero()]];
    let res = bigint_mat_pow(&mat, n, Some(m.clone()));
    match res {
        Ok(m_res) => m_res[0][1].clone(),
        Err(_) => BigInt::zero(),
    }
}

fn bigint_mat_mul(a: &[Vec<BigInt>], b: &[Vec<BigInt>], mod_val: Option<BigInt>) -> Result<Vec<Vec<BigInt>>, String> {
    let r1 = a.len();
    let c1 = a.first().map(|r| r.len()).unwrap_or(0);
    let r2 = b.len();
    let c2 = b.first().map(|r| r.len()).unwrap_or(0);

    if c1 != r2 {
        return Err(format!("Cannot multiply matrix {}×{} with matrix {}×{}", r1, c1, r2, c2));
    }

    let mut res = vec![vec![BigInt::zero(); c2]; r1];
    for i in 0..r1 {
        for k in 0..c1 {
            for j in 0..c2 {
                let term = &a[i][k] * &b[k][j];
                res[i][j] += term;
                if let Some(ref m) = mod_val {
                    res[i][j] = ((&res[i][j] % m) + m) % m;
                }
            }
        }
    }
    Ok(res)
}

fn bigint_mat_pow(a: &[Vec<BigInt>], exp: &BigInt, mod_val: Option<BigInt>) -> Result<Vec<Vec<BigInt>>, String> {
    let n = a.len();
    if n == 0 || a[0].len() != n {
        return Err("Matrix exponentiation requires a square matrix".to_string());
    }

    let mut res = vec![vec![BigInt::zero(); n]; n];
    for i in 0..n { res[i][i] = BigInt::one(); }
    let mut base = a.to_vec();
    let mut e = exp.clone();

    while !e.is_zero() {
        if (&e & BigInt::one()).is_one() {
            res = bigint_mat_mul(&res, &base, mod_val.clone())?;
        }
        base = bigint_mat_mul(&base, &base, mod_val.clone())?;
        e >>= 1;
    }
    Ok(res)
}

#[derive(Debug, PartialEq, Clone)]
enum Token {
    Num(BigInt),
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
            let num = parse_bigint(&num_str).ok_or_else(|| format!("Invalid number: {}", num_str))?;
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
