// src/components/Overlay/widgets/CalculatorWidget.tsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Overlay } from '../../../stores/useOverlayStore';
import { evalCpExpr, CalcResult } from '../../../lib/tauri-bridge';

interface CalculatorWidgetProps {
  overlay: Overlay;
}

type TabType = 'Basic' | 'NumTh' | 'Comb' | 'Bits' | 'Base' | 'Mat';

interface HistoryItem {
  expr: string;
  res: string;
  info?: string;
}

// Function hints dictionary
const PARAM_HINTS: Record<string, { sig: string; desc: string }> = {
  gcd: { sig: 'gcd(a, b)', desc: 'Greatest common divisor of a and b' },
  lcm: { sig: 'lcm(a, b)', desc: 'Least common multiple of a and b' },
  pow: { sig: 'pow(a, b, [m])', desc: 'Fast modular exponentiation (a^b) mod m' },
  phi: { sig: 'phi(n)', desc: 'Euler\'s totient function - count of coprimes ≤ n' },
  extgcd: { sig: 'extgcd(a, b)', desc: 'Extended Euclidean algorithm: ax + by = gcd(a, b)' },
  modinv: { sig: 'modinv(a, m)', desc: 'Modular multiplicative inverse of a modulo m' },
  sqrt: { sig: 'sqrt(n)', desc: 'Integer square root (isqrt)' },
  ilog2: { sig: 'ilog2(n)', desc: 'Floor logarit base 2' },
  is_prime: { sig: 'is_prime(n)', desc: 'Check if n is a prime number' },
  factorize: { sig: 'factorize(n)', desc: 'Prime factorization of n' },
  divisors: { sig: 'divisors(n)', desc: 'List all divisors of n' },
  count_div: { sig: 'count_div(n)', desc: 'Count total divisors of n' },
  sigma: { sig: 'sigma(n)', desc: 'Sum of all divisors σ(n)' },
  sieve: { sig: 'sieve(n)', desc: 'Sieve of Eratosthenes up to n' },
  spf: { sig: 'spf(n)', desc: 'Smallest Prime Factor array up to n' },
  fact: { sig: 'fact(n)', desc: 'Compute factorial n!' },
  fact_mod: { sig: 'fact_mod(n, [m])', desc: 'Compute factorial n! mod m' },
  C: { sig: 'C(n, k)', desc: 'Combinations n choose k (nCk)' },
  P: { sig: 'P(n, k)', desc: 'Permutations n P k (nPk)' },
  C_mod: { sig: 'C_mod(n, k, [m])', desc: 'Combinations nCk mod m' },
  catalan: { sig: 'catalan(n)', desc: 'n-th Catalan number' },
  fib: { sig: 'fib(n)', desc: 'n-th Fibonacci number (Fast doubling)' },
  fib_mod: { sig: 'fib_mod(n, [m])', desc: 'n-th Fibonacci number mod m (Matrix Exponentiation)' },
  popcount: { sig: 'popcount(x)', desc: 'Count set bits (1s) of x' },
  msb: { sig: 'msb(x)', desc: 'Most Significant Bit position' },
  lsb: { sig: 'lsb(x)', desc: 'Least Significant Bit position' },
  lowbit: { sig: 'lowbit(x)', desc: 'Lowbit value: x & (-x)' },
  AND: { sig: 'AND(a, b) or a & b', desc: 'Bitwise AND operation (&)' },
  OR: { sig: 'OR(a, b) or a | b', desc: 'Bitwise OR operation (|)' },
  XOR: { sig: 'XOR(a, b) or a ^ b', desc: 'Bitwise XOR operation (^)' },
  NOT: { sig: 'NOT(x) or ~x', desc: 'Bitwise NOT operation (~)' },
  SHL: { sig: 'SHL(x, k) or x << k', desc: 'Shift left k bits (x << k)' },
  SHR: { sig: 'SHR(x, k) or x >> k', desc: 'Shift right k bits (x >> k)' },
  submask: { sig: 'submask(mask)', desc: 'List all submasks of mask' },
  bin: { sig: 'bin(n)', desc: 'Binary representation (0b...)' },
  hex: { sig: 'hex(n)', desc: 'Hexadecimal representation (0x...)' },
  oct: { sig: 'oct(n)', desc: 'Octal representation (0o...)' },
  to_base: { sig: 'to_base(n, b)', desc: 'Convert n to base b' },
  from_base: { sig: 'from_base(str, b)', desc: 'Convert base b string to decimal integer' },
  mat_mul: { sig: 'mat_mul(A, B, [m])', desc: 'Multiply matrices A × B (optional mod m)' },
  mat_pow: { sig: 'mat_pow(A, n, [m])', desc: 'Matrix exponentiation A^n mod m' },
  identity: { sig: 'identity(n)', desc: 'Create n×n identity matrix' }
};

export const CalculatorWidget: React.FC<CalculatorWidgetProps> = ({ overlay: _overlay }) => {
  const [activeTab, setActiveTab] = useState<TabType>('Basic');
  const [expression, setExpression] = useState<string>('');
  const [result, setResult] = useState<string>('0');
  const [infoLine, setInfoLine] = useState<string>('');
  const [warningMsg, setWarningMsg] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Terminal Session States (RAM-Only)
  const [sessionVars, setSessionVars] = useState<Record<string, string>>({});
  const [modPreset, setModPreset] = useState<string>('1e9+7');
  const [ansValue, setAnsValue] = useState<string>('0');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const activeModDisplay = useMemo(() => {
    if (modPreset === 'none') return 'none';
    return modPreset;
  }, [modPreset]);

  // Detect active function signature hint based on expression cursor/text
  const activeHint = useMemo(() => {
    if (!expression.trim()) return null;
    const match = expression.match(/([a-zA-Z0-9_]+)\s*\([^()]*$/);
    if (match && match[1]) {
      const fnName = match[1];
      if (PARAM_HINTS[fnName]) {
        return PARAM_HINTS[fnName];
      }
    }
    return null;
  }, [expression]);

  // Evaluate Expression using Backend Rust Tokio Thread
  const evaluateExpression = useCallback(async (exprStr: string, isSilent = false) => {
    if (!exprStr.trim()) {
      setResult('0');
      setInfoLine('');
      setWarningMsg('');
      setIsError(false);
      return '0';
    }

    try {
      const res: CalcResult = await evalCpExpr(exprStr, modPreset, ansValue, sessionVars);
      setResult(res.result);
      setInfoLine(res.info || '');
      setWarningMsg(res.warning || '');
      setIsError(false);
      if (res.vars && !isSilent) {
        setSessionVars(res.vars);
      }
      return res.result;
    } catch (err: any) {
      if (!isSilent) {
        setResult('Error');
        setInfoLine(err?.message || err?.hint || 'Invalid Expression');
        setIsError(true);
      }
      return null;
    }
  }, [modPreset, ansValue, sessionVars]);

  // Live preview evaluation on expression change
  useEffect(() => {
    const timer = setTimeout(() => {
      evaluateExpression(expression, true);
    }, 150);
    return () => clearTimeout(timer);
  }, [expression, evaluateExpression]);

  // Keypad Actions with Cursor Position support
  const handleAppend = (val: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? expression.length;
      const end = input.selectionEnd ?? expression.length;
      const newExpr = expression.slice(0, start) + val + expression.slice(end);
      setExpression(newExpr);
      
      setTimeout(() => {
        input.focus();
        const newPos = start + val.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setExpression((prev) => prev + val);
    }
  };

  const handleClear = () => {
    setExpression('');
    setResult('0');
    setInfoLine('');
    setWarningMsg('');
    setIsError(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleDelete = () => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? expression.length;
      const end = input.selectionEnd ?? expression.length;
      if (start !== end) {
        const newExpr = expression.slice(0, start) + expression.slice(end);
        setExpression(newExpr);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start, start);
        }, 0);
      } else if (start > 0) {
        const newExpr = expression.slice(0, start - 1) + expression.slice(start);
        setExpression(newExpr);
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start - 1, start - 1);
        }, 0);
      }
    } else {
      setExpression((prev) => prev.slice(0, -1));
    }
  };

  const handleExecute = async () => {
    const exprToExec = expression.trim();
    if (!exprToExec) return;

    const finalRes = await evaluateExpression(exprToExec, false);
    if (finalRes !== null && !isError) {
      setAnsValue(finalRes);

      // Check if expression is a variable assignment (e.g. "x = 42" or "a = gcd(10, 5)")
      const isAssignment = /=/.test(exprToExec) && !/==|<=|>=|!=/.test(exprToExec);
      
      // Variable assignments automatically update VARS section and are NOT added to History
      if (!isAssignment) {
        setHistory((prev) => [
          { expr: exprToExec, res: finalRes, info: infoLine },
          ...prev.slice(0, 5)
        ]);
      }
      setExpression('');
    }
  };

  const handleCopyResult = () => {
    navigator.clipboard.writeText(ansValue || result);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  // Keyboard navigation - ensure Home, End, Left, Right, Ctrl+Backspace work inside input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Stop parent components or window shortcuts from stealing keys
    const input = inputRef.current;

    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleClear();
    } else if (e.key === 'Home') {
      if (input) {
        e.preventDefault();
        if (e.shiftKey) {
          const end = input.selectionEnd ?? expression.length;
          input.setSelectionRange(0, end);
        } else {
          input.setSelectionRange(0, 0);
        }
      }
    } else if (e.key === 'End') {
      if (input) {
        e.preventDefault();
        const len = expression.length;
        if (e.shiftKey) {
          const start = input.selectionStart ?? 0;
          input.setSelectionRange(start, len);
        } else {
          input.setSelectionRange(len, len);
        }
      }
    } else if (e.key === 'Backspace' && (e.ctrlKey || e.altKey)) {
      if (input) {
        e.preventDefault();
        const start = input.selectionStart ?? expression.length;
        const end = input.selectionEnd ?? expression.length;
        if (start !== end) {
          const newExpr = expression.slice(0, start) + expression.slice(end);
          setExpression(newExpr);
          setTimeout(() => {
            input.focus();
            input.setSelectionRange(start, start);
          }, 0);
        } else if (start > 0) {
          const before = expression.slice(0, start);
          const lastWordMatch = before.match(/(\w+|\s+|[^\w\s]+)$/);
          const cutLen = lastWordMatch ? lastWordMatch[0].length : 1;
          const cutPos = Math.max(0, start - cutLen);
          const newExpr = expression.slice(0, cutPos) + expression.slice(start);
          setExpression(newExpr);
          setTimeout(() => {
            input.focus();
            input.setSelectionRange(cutPos, cutPos);
          }, 0);
        }
      }
    }
  };

  const varListKeys = Object.keys(sessionVars);

  return (
    <div 
      className="flex flex-col h-full bg-[#0d1117] text-[#c9d1d9] font-mono select-none overflow-hidden focus:outline-none"
    >
      {/* 1. Display (Dark Terminal) - Flexible & Expandable when resizing window Taller */}
      <div className="flex-1 min-h-[110px] p-2.5 bg-[#0d1117] border-b border-[#30363d] flex flex-col justify-between overflow-y-auto gap-1 relative">
        {/* History Lines (dim) - shows more when window is expanded */}
        <div className="flex flex-col gap-0.5 min-h-[32px] overflow-y-auto justify-end flex-1 pr-1 scrollbar-thin">
          {history.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[11px] font-mono leading-tight truncate">
              <span className="truncate">
                <span className="text-[#8b949e]">{item.expr}</span>
                <span className="text-[#3d8dd4] font-bold mx-1">=</span>
                <span className="text-[#c9d1d9] font-medium">{item.res}</span>
              </span>
              {item.info && <span className="text-[9px] text-[#484f58] ml-2 shrink-0">{item.info}</span>}
            </div>
          ))}
        </div>

        {/* Input Prompt & Expression */}
        <div className="flex items-center gap-1 text-[12.5px] font-mono mt-1 shrink-0 relative">
          <span className="text-[#3d8dd4] font-bold shrink-0">&gt;&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="enter expression or x = 42..."
            className="w-full bg-transparent text-[#58a6ff] focus:outline-none placeholder-[#30363d] font-mono text-[12.5px]"
          />
        </div>

        {/* Function Signature Hint Tooltip Popup */}
        {activeHint && (
          <div className="bg-[#161b22] border border-[#3794ff]/40 rounded p-1.5 shadow-lg flex flex-col gap-0.5 text-[10px] my-0.5 animate-in fade-in duration-100 shrink-0">
            <div className="text-[#79c0ff] font-bold font-mono">{activeHint.sig}</div>
            <div className="text-[#8b949e] font-sans">{activeHint.desc}</div>
          </div>
        )}

        {/* Heavy Computation Warning Badge */}
        {warningMsg && (
          <div className="bg-amber-950/40 border border-amber-600/40 text-amber-300 rounded px-2 py-0.5 text-[10px] font-sans flex items-center gap-1 my-0.5 shrink-0">
            <span className="codicon codicon-warning text-[11px] shrink-0" />
            <span className="truncate">{warningMsg}</span>
          </div>
        )}

        {/* Result Line (Right-aligned) */}
        <div className="flex flex-col items-end justify-end shrink-0 mt-0.5">
          <div className={`text-[17px] font-medium leading-tight font-mono text-right truncate max-w-full ${isError ? 'text-[#f85149]' : 'text-[#e6edf3]'}`}>
            = {result}
          </div>
          {infoLine && (
            <div className="text-[10px] text-[#484f58] font-mono leading-none mt-0.5">
              {infoLine}
            </div>
          )}
        </div>
      </div>

      {/* Active Session Variables Bar (Terminal Feature) */}
      {varListKeys.length > 0 && (
        <div className="px-2 py-1 bg-[#161b22]/70 border-b border-[#30363d] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10px] shrink-0">
          <span className="text-[#666666] font-semibold text-[9px] uppercase">VARS:</span>
          {varListKeys.map((k) => (
            <button
              key={k}
              onClick={() => handleAppend(k)}
              className="bg-[#21262d] hover:bg-[#30363d] text-[#79c0ff] border border-[#30363d] rounded px-1.5 py-0.2 cursor-pointer truncate max-w-[80px]"
              title={`Click to insert ${k} (${sessionVars[k]})`}
            >
              {k}={sessionVars[k]}
            </button>
          ))}
        </div>
      )}

      {/* 2. Tab Bar */}
      <div className="flex items-center bg-[#161b22] border-b border-[#30363d] shrink-0 overflow-x-auto scrollbar-none text-[11px]">
        {(['Basic', 'NumTh', 'Comb', 'Bits', 'Base', 'Mat'] as TabType[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 px-2 text-center transition-colors font-sans whitespace-nowrap cursor-pointer border-b-2 ${
                isActive
                  ? 'border-[#1f6feb] text-[#ffffff] font-medium bg-[#0d1117]/50'
                  : 'border-transparent text-[#8b949e] hover:text-[#c9d1d9] hover:bg-[#21262d]/40'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* 3. Button Panels - Balanced Height & Padding for Clean VSCode Aesthetic */}
      <div className="shrink-0 p-2 bg-[#0d1117] overflow-y-auto">
        {activeTab === 'Basic' && <BasicPanel onAppend={handleAppend} onClear={handleClear} onDelete={handleDelete} onExec={handleExecute} />}
        {activeTab === 'NumTh' && <NumThPanel onAppend={handleAppend} onClear={handleClear} onDelete={handleDelete} onExec={handleExecute} />}
        {activeTab === 'Comb' && <CombPanel onAppend={handleAppend} onClear={handleClear} onDelete={handleDelete} onExec={handleExecute} />}
        {activeTab === 'Bits' && <BitsPanel onAppend={handleAppend} onClear={handleClear} onDelete={handleDelete} onExec={handleExecute} />}
        {activeTab === 'Base' && <BasePanel onAppend={handleAppend} onClear={handleClear} onDelete={handleDelete} onExec={handleExecute} />}
        {activeTab === 'Mat' && <MatPanel onAppend={handleAppend} onClear={handleClear} onDelete={handleDelete} onExec={handleExecute} />}
      </div>

      {/* 4. Status Bar */}
      <div className="h-7 px-2 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between shrink-0 text-[10.5px] font-mono">
        {/* MOD Dropdown */}
        <div className="flex items-center gap-1 text-[#8b949e]">
          <span className="font-sans font-medium text-[10px]">MOD</span>
          <select
            value={modPreset}
            onChange={(e) => setModPreset(e.target.value)}
            className="bg-[#21262d] text-[#c9d1d9] border border-[#30363d] rounded px-1 py-0.5 text-[10px] focus:outline-none cursor-pointer"
          >
            <option value="1e9+7">1e9+7</option>
            <option value="998244353">998244353</option>
            <option value="1e9+9">1e9+9</option>
            <option value="none">none</option>
          </select>
        </div>

        {/* ans & M info */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleAppend('ans')}
            className="hover:text-[#58a6ff] text-[#8b949e] transition-colors cursor-pointer truncate max-w-[90px]"
            title="Click to insert ans"
          >
            ans={ansValue.length > 8 ? ansValue.slice(0, 6) + '…' : ansValue}
          </button>
          <span className="text-[#484f58]">|</span>
          <span className="text-[#8b949e]">M={activeModDisplay}</span>
        </div>

        {/* Copy Button */}
        <button
          onClick={handleCopyResult}
          className="px-2 py-0.5 rounded bg-[#21262d] hover:bg-[#30363d] text-[#c9d1d9] border border-[#30363d] transition-colors cursor-pointer text-[10px] font-sans"
        >
          {isCopied ? '✓ Copied' : 'copy'}
        </button>
      </div>
    </div>
  );
};

// Helper Button Component - clean height and text alignment
interface BtnProps {
  label: string;
  type?: 'default' | 'op' | 'fn' | 'eq' | 'del' | 'clr' | 'ph';
  onClick?: () => void;
  colSpan?: number;
  rowSpan?: number;
}

const CalcBtn: React.FC<BtnProps> = ({ label, type = 'default', onClick, colSpan, rowSpan }) => {
  if (type === 'ph') {
    return <div className="invisible h-8" />;
  }

  let styleClass = 'bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] border-[#30363d]';
  if (type === 'op') styleClass = 'bg-[#162338] text-[#58a6ff] hover:bg-[#1f314d] border-[#203454] font-medium';
  if (type === 'fn') styleClass = 'bg-[#1b222d] text-[#79c0ff] hover:bg-[#273142] border-[#2b3648] text-[11px] font-medium';
  if (type === 'eq') styleClass = 'bg-[#1f6feb] text-[#ffffff] hover:bg-[#388bfd] border-[#388bfd] font-bold';
  if (type === 'del') styleClass = 'bg-[#3c1e1e] text-[#f85149] hover:bg-[#4c2424] border-[#542424] font-medium';
  if (type === 'clr') styleClass = 'bg-[#3c321e] text-[#d29922] hover:bg-[#4c3e24] border-[#544424] font-medium';

  const colClass = colSpan ? `col-span-${colSpan}` : '';
  const rowClass = rowSpan ? `row-span-${rowSpan}` : '';

  return (
    <button
      onClick={onClick}
      className={`rounded border h-8 px-1 flex items-center justify-center text-xs font-mono transition-all active:scale-[0.98] cursor-pointer select-none truncate ${styleClass} ${colClass} ${rowClass}`}
    >
      {label}
    </button>
  );
};

// --- TAB PANELS --- //

interface PanelProps {
  onAppend: (val: string) => void;
  onClear: () => void;
  onDelete: () => void;
  onExec: () => void;
}

const BasicPanel: React.FC<PanelProps> = ({ onAppend, onClear, onDelete, onExec }) => (
  <div className="grid grid-cols-5 gap-1.5">
    <CalcBtn label="C" type="clr" onClick={onClear} />
    <CalcBtn label="(" type="default" onClick={() => onAppend('(')} />
    <CalcBtn label=")" type="default" onClick={() => onAppend(')')} />
    <CalcBtn label="DEL" type="del" onClick={onDelete} />
    <CalcBtn label="%" type="op" onClick={() => onAppend('%')} />

    <CalcBtn label="7" onClick={() => onAppend('7')} />
    <CalcBtn label="8" onClick={() => onAppend('8')} />
    <CalcBtn label="9" onClick={() => onAppend('9')} />
    <CalcBtn label="×" type="op" onClick={() => onAppend('*')} />
    <CalcBtn label="÷" type="op" onClick={() => onAppend('/')} />

    <CalcBtn label="4" onClick={() => onAppend('4')} />
    <CalcBtn label="5" onClick={() => onAppend('5')} />
    <CalcBtn label="6" onClick={() => onAppend('6')} />
    <CalcBtn label="+" type="op" onClick={() => onAppend('+')} />
    <CalcBtn label="-" type="op" onClick={() => onAppend('-')} />

    <CalcBtn label="1" onClick={() => onAppend('1')} />
    <CalcBtn label="2" onClick={() => onAppend('2')} />
    <CalcBtn label="3" onClick={() => onAppend('3')} />
    <CalcBtn label="^" type="op" onClick={() => onAppend('^')} />
    <CalcBtn label="," type="default" onClick={() => onAppend(',')} />

    <CalcBtn label="0" onClick={() => onAppend('0')} />
    <CalcBtn label="." onClick={() => onAppend('.')} />
    <CalcBtn label="M" type="op" onClick={() => onAppend('M')} />
    <CalcBtn label="ans" type="op" onClick={() => onAppend('ans')} />
    <CalcBtn label="=" type="eq" onClick={onExec} />
  </div>
);

const NumThPanel: React.FC<PanelProps> = ({ onAppend, onClear, onDelete, onExec }) => (
  <div className="grid grid-cols-4 gap-1.5">
    <CalcBtn label="gcd" type="fn" onClick={() => onAppend('gcd(')} />
    <CalcBtn label="lcm" type="fn" onClick={() => onAppend('lcm(')} />
    <CalcBtn label="pow" type="fn" onClick={() => onAppend('pow(')} />
    <CalcBtn label="phi" type="fn" onClick={() => onAppend('phi(')} />

    <CalcBtn label="extgcd" type="fn" onClick={() => onAppend('extgcd(')} />
    <CalcBtn label="modinv" type="fn" onClick={() => onAppend('modinv(')} />
    <CalcBtn label="sqrt" type="fn" onClick={() => onAppend('sqrt(')} />
    <CalcBtn label="ilog2" type="fn" onClick={() => onAppend('ilog2(')} />

    <CalcBtn label="is_prime" type="fn" onClick={() => onAppend('is_prime(')} />
    <CalcBtn label="factorize" type="fn" onClick={() => onAppend('factorize(')} />
    <CalcBtn label="divisors" type="fn" onClick={() => onAppend('divisors(')} />
    <CalcBtn label="count_div" type="fn" onClick={() => onAppend('count_div(')} />

    <CalcBtn label="sigma" type="fn" onClick={() => onAppend('sigma(')} />
    <CalcBtn label="sieve" type="fn" onClick={() => onAppend('sieve(')} />
    <CalcBtn label="spf" type="fn" onClick={() => onAppend('spf(')} />
    <CalcBtn label="M" type="op" onClick={() => onAppend('M')} />

    <CalcBtn label="DEL" type="del" onClick={onDelete} />
    <CalcBtn label="CLR" type="clr" onClick={onClear} />
    <CalcBtn label="ans" type="op" onClick={() => onAppend('ans')} />
    <CalcBtn label="=" type="eq" onClick={onExec} />
  </div>
);

const CombPanel: React.FC<PanelProps> = ({ onAppend, onClear, onDelete, onExec }) => (
  <div className="grid grid-cols-4 gap-1.5">
    <CalcBtn label="fact" type="fn" onClick={() => onAppend('fact(')} />
    <CalcBtn label="fact_mod" type="fn" onClick={() => onAppend('fact_mod(')} />
    <CalcBtn label="C" type="fn" onClick={() => onAppend('C(')} />
    <CalcBtn label="P" type="fn" onClick={() => onAppend('P(')} />

    <CalcBtn label="C_mod" type="fn" onClick={() => onAppend('C_mod(')} />
    <CalcBtn label="catalan" type="fn" onClick={() => onAppend('catalan(')} />
    <CalcBtn label="fib" type="fn" onClick={() => onAppend('fib(')} />
    <CalcBtn label="fib_mod" type="fn" onClick={() => onAppend('fib_mod(')} />

    <CalcBtn label="," type="default" onClick={() => onAppend(',')} />
    <CalcBtn label="(" type="default" onClick={() => onAppend('(')} />
    <CalcBtn label=")" type="default" onClick={() => onAppend(')')} />
    <CalcBtn label="M" type="op" onClick={() => onAppend('M')} />

    <CalcBtn label="DEL" type="del" onClick={onDelete} />
    <CalcBtn label="CLR" type="clr" onClick={onClear} />
    <CalcBtn label="ans" type="op" onClick={() => onAppend('ans')} />
    <CalcBtn label="=" type="eq" onClick={onExec} />
  </div>
);

const BitsPanel: React.FC<PanelProps> = ({ onAppend, onClear, onDelete, onExec }) => (
  <div className="grid grid-cols-4 gap-1.5">
    <CalcBtn label="popcount" type="fn" onClick={() => onAppend('popcount(')} />
    <CalcBtn label="msb" type="fn" onClick={() => onAppend('msb(')} />
    <CalcBtn label="lsb" type="fn" onClick={() => onAppend('lsb(')} />
    <CalcBtn label="lowbit" type="fn" onClick={() => onAppend('lowbit(')} />

    <CalcBtn label="AND" type="fn" onClick={() => onAppend(' AND ')} />
    <CalcBtn label="OR" type="fn" onClick={() => onAppend(' OR ')} />
    <CalcBtn label="XOR" type="fn" onClick={() => onAppend(' XOR ')} />
    <CalcBtn label="NOT" type="fn" onClick={() => onAppend('NOT(')} />

    <CalcBtn label="SHL(<<)" type="fn" onClick={() => onAppend(' << ')} />
    <CalcBtn label="SHR(>>)" type="fn" onClick={() => onAppend(' >> ')} />
    <CalcBtn label="submask" type="fn" onClick={() => onAppend('submask(')} />
    <CalcBtn label=")" type="default" onClick={() => onAppend(')')} />

    <CalcBtn label="," type="default" onClick={() => onAppend(',')} />
    <CalcBtn label="(" type="default" onClick={() => onAppend('(')} />
    <CalcBtn label="M" type="op" onClick={() => onAppend('M')} />
    <CalcBtn label="ans" type="op" onClick={() => onAppend('ans')} />

    <CalcBtn label="DEL" type="del" onClick={onDelete} />
    <CalcBtn label="CLR" type="clr" onClick={onClear} />
    <CalcBtn label="" type="ph" />
    <CalcBtn label="=" type="eq" onClick={onExec} />
  </div>
);

const BasePanel: React.FC<PanelProps> = ({ onAppend, onClear, onDelete, onExec }) => (
  <div className="grid grid-cols-4 gap-1.5">
    <CalcBtn label="bin" type="fn" onClick={() => onAppend('bin(')} />
    <CalcBtn label="hex" type="fn" onClick={() => onAppend('hex(')} />
    <CalcBtn label="oct" type="fn" onClick={() => onAppend('oct(')} />
    <CalcBtn label="," type="default" onClick={() => onAppend(',')} />

    <CalcBtn label="to_base" type="fn" onClick={() => onAppend('to_base(')} />
    <CalcBtn label="from_base" type="fn" onClick={() => onAppend('from_base(')} />
    <CalcBtn label="(" type="default" onClick={() => onAppend('(')} />
    <CalcBtn label=")" type="default" onClick={() => onAppend(')')} />

    <CalcBtn label="DEL" type="del" onClick={onDelete} />
    <CalcBtn label="CLR" type="clr" onClick={onClear} />
    <CalcBtn label="ans" type="op" onClick={() => onAppend('ans')} />
    <CalcBtn label="=" type="eq" onClick={onExec} />
  </div>
);

const MatPanel: React.FC<PanelProps> = ({ onAppend, onClear, onDelete, onExec }) => (
  <div className="grid grid-cols-4 gap-1.5">
    <CalcBtn label="mat_mul" type="fn" onClick={() => onAppend('mat_mul(')} />
    <CalcBtn label="mat_pow" type="fn" onClick={() => onAppend('mat_pow(')} />
    <CalcBtn label="identity" type="fn" onClick={() => onAppend('identity(')} />
    <CalcBtn label="M" type="op" onClick={() => onAppend('M')} />

    <CalcBtn label="[[" type="default" onClick={() => onAppend('[[')} />
    <CalcBtn label="]]" type="default" onClick={() => onAppend(']]')} />
    <CalcBtn label="[" type="default" onClick={() => onAppend('[')} />
    <CalcBtn label="]" type="default" onClick={() => onAppend(']')} />

    <CalcBtn label="," type="default" onClick={() => onAppend(',')} />
    <CalcBtn label="(" type="default" onClick={() => onAppend('(')} />
    <CalcBtn label=")" type="default" onClick={() => onAppend(')')} />
    <CalcBtn label="ans" type="op" onClick={() => onAppend('ans')} />

    <CalcBtn label="DEL" type="del" onClick={onDelete} />
    <CalcBtn label="CLR" type="clr" onClick={onClear} />
    <CalcBtn label="" type="ph" />
    <CalcBtn label="=" type="eq" onClick={onExec} />
  </div>
);
