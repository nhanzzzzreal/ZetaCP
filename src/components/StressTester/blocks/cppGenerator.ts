// src/components/StressTester/blocks/cppGenerator.ts
import * as Blockly from 'blockly';

export const Order = {
  ATOMIC: 0, UNARY: 1, MULTIPLICATIVE: 2, ADDITIVE: 3,
  RELATIONAL: 4, EQUALITY: 5, LOGICAL_AND: 6, LOGICAL_OR: 7,
  ASSIGNMENT: 8, NONE: 99,
} as const;

export class CppGenerator extends Blockly.Generator {
  declaredVars = new Set<string>();
  constructor() { super('CPP'); }
  init(workspace: Blockly.Workspace): void {
    super.init(workspace);
    this.declaredVars.clear();
  }
}

export const cppGenerator = new CppGenerator();

cppGenerator.scrub_ = function (block: Blockly.Block, code: string, thisOnly?: boolean): string {
  if (block.type === 'multitest_start') {
    return code;
  }
  const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  return code + (thisOnly ? '' : this.blockToCode(nextBlock));
};

const getVarName = (block: Blockly.Block, fieldName = 'VAR'): string => {
  const field = block.getField(fieldName);
  return field ? field.getText() : (block.getFieldValue(fieldName) || 'x');
};

const valCode = (block: Blockly.Block, gen: any, name: string, def = '0'): string => {
  return gen.valueToCode(block, name, Order.ATOMIC) || def;
};

// --- Structure Blocks ---
cppGenerator.forBlock['when_start'] = () => '';
cppGenerator.forBlock['setup_hat'] = () => '';
cppGenerator.forBlock['call_setup'] = () => '// setup call\n';

cppGenerator.forBlock['set_variable'] = (b: Blockly.Block, g: any) => {
  const v = getVarName(b, 'VAR');
  const val = valCode(b, g, 'VALUE', '0');
  const gen = cppGenerator;
  if (gen.declaredVars.has(v)) return `${v} = ${val};\n`;
  gen.declaredVars.add(v);
  return `int ${v} = ${val};\n`;
};

cppGenerator.forBlock['multitest_start'] = (b: Blockly.Block, g: any) => {
  const tc = valCode(b, g, 'TEST_COUNT', '10');
  let body = '';
  const nextBlock = b.nextConnection && b.nextConnection.targetBlock();
  if (nextBlock) {
    body = g.blockToCode(nextBlock, true);
  }
  const indented = body.split('\n').map((l: string) => (l ? '    ' + l : '')).join('\n');
  return `cout << ${tc} << "\\n";\nint T = ${tc};\nfor (int _t = 0; _t < T; _t++) {\n${indented}}\n`;
};

// --- Primitive Blocks ---
cppGenerator.forBlock['randInt'] = (b: Blockly.Block, g: any) => [`rnd.next(${valCode(b, g, 'L', '1')}, ${valCode(b, g, 'R', '100')})`, Order.ATOMIC];
cppGenerator.forBlock['randRange'] = (b: Blockly.Block, g: any) => {
  const l1 = valCode(b, g, 'LMIN', '1'), l2 = valCode(b, g, 'LMAX', '10');
  const r1 = valCode(b, g, 'RMIN', '10'), r2 = valCode(b, g, 'RMAX', '100');
  return [`(to_string(rnd.next(${l1}, ${l2})) + " " + to_string(rnd.next(${r1}, ${r2})))`, Order.ATOMIC];
};
cppGenerator.forBlock['randChar'] = (b: Blockly.Block) => {
  const cs = b.getFieldValue('CHARSET') || 'a-z';
  const pMap: Record<string, string> = { 'A-Z': '[A-Z]', '0-9': '[0-9]', 'a-zA-Z': '[a-zA-Z]', 'a-zA-Z0-9': '[a-zA-Z0-9]' };
  return [`rnd.next("${pMap[cs] || '[a-z]'}")`, Order.ATOMIC];
};
cppGenerator.forBlock['randFloat'] = (b: Blockly.Block, g: any) => [`rnd.next((double)${valCode(b, g, 'L', '0.0')}, (double)${valCode(b, g, 'R', '1.0')})`, Order.ATOMIC];

// --- IO Blocks ---
cppGenerator.forBlock['print_val'] = (b: Blockly.Block, g: any) => {
  const cnt = (b as unknown as { itemCount_: number }).itemCount_ || 1;
  const vals: string[] = [];
  for (let i = 0; i < cnt; i++) vals.push(valCode(b, g, 'VAL' + i, '""'));
  return vals.length > 0 ? `cout << ${vals.join(' << " " << ')} << " ";\n` : 'cout << " ";\n';
};

cppGenerator.forBlock['println_val'] = (b: Blockly.Block, g: any) => {
  const cnt = (b as unknown as { itemCount_: number }).itemCount_ ?? 1;
  const vals: string[] = [];
  for (let i = 0; i < cnt; i++) vals.push(valCode(b, g, 'VAL' + i, '""'));
  return vals.length > 0 ? `cout << ${vals.join(' << " " << ')} << "\\n";\n` : 'cout << "\\n";\n';
};

// --- Control & Math Blocks ---
cppGenerator.forBlock['controls_repeat_ext'] = (b: Blockly.Block, g: any) => `for (int _i = 0; _i < ${valCode(b, g, 'TIMES', '10')}; _i++) {\n${g.statementToCode(b, 'STACK')}}\n`;
cppGenerator.forBlock['controls_for'] = (b: Blockly.Block, g: any) => {
  const v = getVarName(b, 'VAR');
  cppGenerator.declaredVars.add(v);
  return `for (int ${v} = ${valCode(b, g, 'FROM', '1')}; ${v} <= ${valCode(b, g, 'TO', '10')}; ${v} += ${valCode(b, g, 'BY', '1')}) {\n${g.statementToCode(b, 'STACK')}}\n`;
};
cppGenerator.forBlock['controls_whileUntil'] = (b: Blockly.Block, g: any) => {
  const c = valCode(b, g, 'BOOL', 'true');
  const cond = b.getFieldValue('MODE') === 'UNTIL' ? `!(${c})` : c;
  return `while (${cond}) {\n${g.statementToCode(b, 'STACK')}}\n`;
};
cppGenerator.forBlock['controls_if'] = (b: Blockly.Block, g: any) => {
  const c = valCode(b, g, 'IF0', 'true');
  const t = g.statementToCode(b, 'THEN0');
  const e = g.statementToCode(b, 'ELSE');
  return `if (${c}) {\n${t}}${e ? ' else {\n' + e + '}' : ''}\n`;
};

cppGenerator.forBlock['math_number'] = (b: Blockly.Block) => [String(b.getFieldValue('NUM') ?? 0), Order.ATOMIC];
cppGenerator.forBlock['math_arithmetic'] = (b: Blockly.Block, g: any) => {
  const opMap: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/' };
  return [`(${valCode(b, g, 'A', '0')} ${opMap[b.getFieldValue('OP')] || '+'} ${valCode(b, g, 'B', '0')})`, Order.ATOMIC];
};
cppGenerator.forBlock['math_modulo'] = (b: Blockly.Block, g: any) => [`(${valCode(b, g, 'DIVIDEND', '0')} % ${valCode(b, g, 'DIVISOR', '1')})`, Order.ATOMIC];
cppGenerator.forBlock['math_single'] = (b: Blockly.Block, g: any) => {
  const op = b.getFieldValue('OP'); const num = valCode(b, g, 'NUM', '0');
  return [op === 'ABS' ? `abs(${num})` : op === 'ROOT' ? `sqrt(${num})` : num, Order.ATOMIC];
};
cppGenerator.forBlock['logic_compare'] = (b: Blockly.Block, g: any) => {
  const opMap: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  return [`(${valCode(b, g, 'A', '0')} ${opMap[b.getFieldValue('OP')] || '=='} ${valCode(b, g, 'B', '0')})`, Order.RELATIONAL];
};
cppGenerator.forBlock['logic_operation'] = (b: Blockly.Block, g: any) => [`(${valCode(b, g, 'A', 'true')} ${b.getFieldValue('OP') === 'AND' ? '&&' : '||'} ${valCode(b, g, 'B', 'true')})`, Order.LOGICAL_AND];
cppGenerator.forBlock['logic_negate'] = (b: Blockly.Block, g: any) => [`!(${valCode(b, g, 'BOOL', 'false')})`, Order.UNARY];
cppGenerator.forBlock['logic_boolean'] = (b: Blockly.Block) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', Order.ATOMIC];
cppGenerator.forBlock['variables_get'] = (b: Blockly.Block) => [getVarName(b, 'VAR'), Order.ATOMIC];
cppGenerator.forBlock['variables_set'] = (b: Blockly.Block, g: any) => `${getVarName(b, 'VAR')} = ${valCode(b, g, 'VALUE', '0')};\n`;

// --- Convenience Blocks ---
cppGenerator.forBlock['cp_array'] = (b: Blockly.Block, g: any) => {
  const sz = valCode(b, g, 'SIZE', '10'), mn = valCode(b, g, 'MIN', '1'), mx = valCode(b, g, 'MAX', '100');
  if (b.getFieldValue('DISTINCT') === 'TRUE') {
    return `{\n    vector<int> _a;\n    for (int _i = ${mn}; _i <= ${mx}; _i++) _a.push_back(_i);\n    rnd.shuffle(_a.begin(), _a.end());\n    for (int _i = 0; _i < ${sz}; _i++) cout << _a[_i] << (_i == ${sz} - 1 ? "" : " ");\n    cout << "\\n";\n}\n`;
  }
  return `for (int _i = 0; _i < ${sz}; _i++) cout << rnd.next(${mn}, ${mx}) << (_i == ${sz} - 1 ? "" : " ");\ncout << "\\n";\n`;
};

cppGenerator.forBlock['cp_sorted_array'] = (b: Blockly.Block, g: any) => {
  const sz = valCode(b, g, 'SIZE', '10'), mn = valCode(b, g, 'MIN', '1'), mx = valCode(b, g, 'MAX', '100');
  const comp = b.getFieldValue('ORDER') === 'DESC' ? ', greater<int>()' : '';
  return `{\n    vector<int> _a(${sz});\n    for (int _i = 0; _i < ${sz}; _i++) _a[_i] = rnd.next(${mn}, ${mx});\n    sort(_a.begin(), _a.end()${comp});\n    for (int _i = 0; _i < ${sz}; _i++) cout << _a[_i] << (_i == ${sz} - 1 ? "" : " ");\n    cout << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_permutation'] = (b: Blockly.Block, g: any) => {
  const sz = valCode(b, g, 'SIZE', '10'), base = b.getFieldValue('BASE') || '1';
  return `{\n    vector<int> _p = rnd.perm(${sz}, ${base});\n    for (int _i = 0; _i < ${sz}; _i++) cout << _p[_i] << (_i == ${sz} - 1 ? "" : " ");\n    cout << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_string'] = (b: Blockly.Block, g: any) => {
  const len = valCode(b, g, 'LENGTH', '10'), cs = b.getFieldValue('CHARSET') || 'abcdefghijklmnopqrstuvwxyz';
  return `{\n    string _cs = "${cs}"; string _s = "";\n    for (int _i = 0; _i < ${len}; _i++) _s += _cs[rnd.next(0, (int)_cs.length() - 1)];\n    cout << _s << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_palindrome'] = (b: Blockly.Block, g: any) => {
  const len = valCode(b, g, 'LENGTH', '10'), cs = b.getFieldValue('CHARSET') || 'abcdefghijklmnopqrstuvwxyz';
  return `{\n    string _cs = "${cs}"; int _l = ${len};\n    string _h = ""; for (int _i = 0; _i < _l / 2; _i++) _h += _cs[rnd.next(0, (int)_cs.length() - 1)];\n    string _m = (_l % 2 != 0) ? string(1, _cs[rnd.next(0, (int)_cs.length() - 1)]) : "";\n    string _rev = _h; reverse(_rev.begin(), _rev.end());\n    cout << (_h + _m + _rev) << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_brackets'] = (b: Blockly.Block, g: any) => {
  const len = valCode(b, g, 'LENGTH', '10');
  if (b.getFieldValue('BALANCED') === 'TRUE') {
    return `{\n    int _n = (${len}) / 2;\n    string _s = string(_n, '(') + string(_n, ')');\n    rnd.shuffle(_s.begin(), _s.end());\n    cout << _s << "\\n";\n}\n`;
  }
  return `{\n    string _s = "";\n    for (int _i = 0; _i < ${len}; _i++) _s += rnd.next(0, 1) ? '(' : ')';\n    cout << _s << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_tree_random'] = (b: Blockly.Block, g: any) => {
  const v = valCode(b, g, 'VERTICES', '5'), base = b.getFieldValue('BASE') || '1';
  return `{\n    int _n = ${v};\n    vector<pair<int,int>> _e;\n    for (int _i = ${base} + 1; _i < _n + ${base}; _i++) _e.push_back({_i, rnd.next(${base}, _i - 1)});\n    rnd.shuffle(_e.begin(), _e.end());\n    for (auto& _p : _e) cout << _p.first << " " << _p.second << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_tree_bamboo'] = (b: Blockly.Block, g: any) => {
  const v = valCode(b, g, 'VERTICES', '5'), base = b.getFieldValue('BASE') || '1';
  return `{\n    int _n = ${v};\n    vector<int> _nodes(_n);\n    for (int _i = 0; _i < _n; _i++) _nodes[_i] = _i + ${base};\n    rnd.shuffle(_nodes.begin(), _nodes.end());\n    for (int _i = 0; _i < _n - 1; _i++) cout << _nodes[_i] << " " << _nodes[_i+1] << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_tree_star'] = (b: Blockly.Block, g: any) => {
  const v = valCode(b, g, 'VERTICES', '5'), base = b.getFieldValue('BASE') || '1';
  return `{\n    int _n = ${v};\n    for (int _i = ${base} + 1; _i < _n + ${base}; _i++) cout << ${base} << " " << _i << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_graph'] = (b: Blockly.Block, g: any) => {
  const v = valCode(b, g, 'VERTICES', '5'), m = valCode(b, g, 'EDGES', '5'), base = b.getFieldValue('BASE') || '1';
  return `{\n    int _v = ${v}, _m = ${m};\n    for (int _i = 0; _i < _m; _i++) cout << rnd.next(${base}, _v + ${base} - 1) << " " << rnd.next(${base}, _v + ${base} - 1) << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_dag'] = (b: Blockly.Block, g: any) => {
  const v = valCode(b, g, 'VERTICES', '5'), m = valCode(b, g, 'EDGES', '5'), base = b.getFieldValue('BASE') || '1';
  return `{\n    int _v = ${v}, _m = ${m};\n    for (int _i = 0; _i < _m; _i++) {\n        int _u = rnd.next(${base}, _v + ${base} - 2);\n        cout << _u << " " << rnd.next(_u + 1, _v + ${base} - 1) << "\\n";\n    }\n}\n`;
};

cppGenerator.forBlock['cp_grid'] = (b: Blockly.Block, g: any) => {
  const r = valCode(b, g, 'ROWS', '3'), c = valCode(b, g, 'COLS', '3'), mn = valCode(b, g, 'MIN', '0'), mx = valCode(b, g, 'MAX', '1');
  return `{\n    int _r = ${r}, _c = ${c};\n    for (int _i = 0; _i < _r; _i++) {\n        for (int _j = 0; _j < _c; _j++) cout << rnd.next(${mn}, ${mx}) << (_j == _c - 1 ? "" : " ");\n        cout << "\\n";\n    }\n}\n`;
};

cppGenerator.forBlock['cp_grid_obstacles'] = (b: Blockly.Block, g: any) => {
  const r = valCode(b, g, 'ROWS', '3'), c = valCode(b, g, 'COLS', '3'), d = b.getFieldValue('DENSITY') ?? 30;
  return `{\n    int _r = ${r}, _c = ${c}, _d = ${d};\n    for (int _i = 0; _i < _r; _i++) {\n        string _row = "";\n        for (int _j = 0; _j < _c; _j++) _row += (rnd.next(1, 100) <= _d ? '#' : '.');\n        cout << _row << "\\n";\n    }\n}\n`;
};

cppGenerator.forBlock['cp_points_2d'] = (b: Blockly.Block, g: any) => {
  const cnt = valCode(b, g, 'COUNT', '10'), mn = valCode(b, g, 'MIN', '-100'), mx = valCode(b, g, 'MAX', '100');
  return `{\n    int _cnt = ${cnt};\n    for (int _i = 0; _i < _cnt; _i++) cout << rnd.next(${mn}, ${mx}) << " " << rnd.next(${mn}, ${mx}) << "\\n";\n}\n`;
};

cppGenerator.forBlock['cp_range_query'] = (b: Blockly.Block, g: any) => {
  const cnt = valCode(b, g, 'COUNT', '10'), n = valCode(b, g, 'MAX_N', '100'), base = b.getFieldValue('BASE') || '1';
  return `{\n    int _cnt = ${cnt}, _n = ${n};\n    for (int _i = 0; _i < _cnt; _i++) {\n        int _l = rnd.next(${base}, _n + ${base} - 1);\n        cout << _l << " " << rnd.next(_l, _n + ${base} - 1) << "\\n";\n    }\n}\n`;
};
