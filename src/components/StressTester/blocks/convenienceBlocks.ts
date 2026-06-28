// src/components/StressTester/blocks/convenienceBlocks.ts
import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

export const registerConvenienceBlocks = () => {
  const blockTypes = [
    'cp_array', 'cp_sorted_array', 'cp_permutation', 'cp_string',
    'cp_palindrome', 'cp_brackets', 'cp_tree_random', 'cp_tree_bamboo',
    'cp_tree_star', 'cp_graph', 'cp_dag', 'cp_grid', 'cp_grid_obstacles',
    'cp_points_2d', 'cp_range_query'
  ];

  for (const t of blockTypes) {
    delete Blockly.Blocks[t];
  }

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'cp_array', message0: 'Array size %1 min %2 max %3 distinct %4',
      args0: [{ type: 'input_value', name: 'SIZE' }, { type: 'input_value', name: 'MIN' }, { type: 'input_value', name: 'MAX' }, { type: 'field_checkbox', name: 'DISTINCT', checked: false }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#6366F1', tooltip: 'Generates a random array'
    },
    {
      type: 'cp_sorted_array', message0: 'Sorted Array size %1 min %2 max %3 order %4',
      args0: [{ type: 'input_value', name: 'SIZE' }, { type: 'input_value', name: 'MIN' }, { type: 'input_value', name: 'MAX' }, { type: 'field_dropdown', name: 'ORDER', options: [['Ascending', 'ASC'], ['Descending', 'DESC']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#6366F1', tooltip: 'Generates a sorted array'
    },
    {
      type: 'cp_permutation', message0: 'Permutation size %1 base %2',
      args0: [{ type: 'input_value', name: 'SIZE' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#6366F1', tooltip: 'Generates a permutation'
    },
    {
      type: 'cp_string', message0: 'String length %1 charset %2',
      args0: [{ type: 'input_value', name: 'LENGTH' }, { type: 'field_dropdown', name: 'CHARSET', options: [['a-z', 'abcdefghijklmnopqrstuvwxyz'], ['A-Z', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], ['0-9', '0123456789'], ['a-zA-Z', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#A855F7', tooltip: 'Generates a random string'
    },
    {
      type: 'cp_palindrome', message0: 'Palindrome length %1 charset %2',
      args0: [{ type: 'input_value', name: 'LENGTH' }, { type: 'field_dropdown', name: 'CHARSET', options: [['a-z', 'abcdefghijklmnopqrstuvwxyz'], ['A-Z', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#A855F7', tooltip: 'Generates a palindrome string'
    },
    {
      type: 'cp_brackets', message0: 'Brackets length %1 balanced %2',
      args0: [{ type: 'input_value', name: 'LENGTH' }, { type: 'field_checkbox', name: 'BALANCED', checked: true }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#A855F7', tooltip: 'Generates brackets sequence'
    },
    {
      type: 'cp_tree_random', message0: 'Random Tree vertices %1 base %2',
      args0: [{ type: 'input_value', name: 'VERTICES' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#06B6D4', tooltip: 'Generates a random tree'
    },
    {
      type: 'cp_tree_bamboo', message0: 'Bamboo Tree vertices %1 base %2',
      args0: [{ type: 'input_value', name: 'VERTICES' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#06B6D4', tooltip: 'Generates a bamboo tree'
    },
    {
      type: 'cp_tree_star', message0: 'Star Tree vertices %1 base %2',
      args0: [{ type: 'input_value', name: 'VERTICES' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#06B6D4', tooltip: 'Generates a star tree'
    },
    {
      type: 'cp_graph', message0: 'Graph vertices %1 edges %2 base %3',
      args0: [{ type: 'input_value', name: 'VERTICES' }, { type: 'input_value', name: 'EDGES' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#06B6D4', tooltip: 'Generates a random graph'
    },
    {
      type: 'cp_dag', message0: 'DAG vertices %1 edges %2 base %3',
      args0: [{ type: 'input_value', name: 'VERTICES' }, { type: 'input_value', name: 'EDGES' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#06B6D4', tooltip: 'Generates a DAG'
    },
    {
      type: 'cp_grid', message0: 'Grid rows %1 cols %2 min %3 max %4',
      args0: [{ type: 'input_value', name: 'ROWS' }, { type: 'input_value', name: 'COLS' }, { type: 'input_value', name: 'MIN' }, { type: 'input_value', name: 'MAX' }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#14B8A6', tooltip: 'Generates a 2D grid'
    },
    {
      type: 'cp_grid_obstacles', message0: 'Grid Obstacles rows %1 cols %2 density %3 %',
      args0: [{ type: 'input_value', name: 'ROWS' }, { type: 'input_value', name: 'COLS' }, { type: 'field_number', name: 'DENSITY', value: 30, min: 0, max: 100 }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#14B8A6', tooltip: 'Generates a grid with obstacles'
    },
    {
      type: 'cp_points_2d', message0: 'Points 2D count %1 min %2 max %3',
      args0: [{ type: 'input_value', name: 'COUNT' }, { type: 'input_value', name: 'MIN' }, { type: 'input_value', name: 'MAX' }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#14B8A6', tooltip: 'Generates 2D points'
    },
    {
      type: 'cp_range_query', message0: 'Range Query count %1 max N %2 base %3',
      args0: [{ type: 'input_value', name: 'COUNT' }, { type: 'input_value', name: 'MAX_N' }, { type: 'field_dropdown', name: 'BASE', options: [['1-based', '1'], ['0-based', '0']] }],
      inputsInline: true, previousStatement: null, nextStatement: null, colour: '#14B8A6', tooltip: 'Generates range queries'
    },
  ]);

  // Python Generators
  pythonGenerator.forBlock['cp_array'] = function (block: Blockly.Block, gen: any) {
    const sz = gen.valueToCode(block, 'SIZE', Order.ATOMIC) || '10';
    const mn = gen.valueToCode(block, 'MIN', Order.ATOMIC) || '1';
    const mx = gen.valueToCode(block, 'MAX', Order.ATOMIC) || '100';
    return block.getFieldValue('DISTINCT') === 'TRUE'
      ? `print(*random.sample(range(${mn}, ${mx} + 1), ${sz}))\n`
      : `print(*[random.randint(${mn}, ${mx}) for _ in range(${sz})])\n`;
  };

  pythonGenerator.forBlock['cp_sorted_array'] = function (block: Blockly.Block, gen: any) {
    const sz = gen.valueToCode(block, 'SIZE', Order.ATOMIC) || '10';
    const mn = gen.valueToCode(block, 'MIN', Order.ATOMIC) || '1';
    const mx = gen.valueToCode(block, 'MAX', Order.ATOMIC) || '100';
    const rev = block.getFieldValue('ORDER') === 'DESC' ? ', reverse=True' : '';
    return `print(*sorted([random.randint(${mn}, ${mx}) for _ in range(${sz})]${rev}))\n`;
  };

  pythonGenerator.forBlock['cp_permutation'] = function (block: Blockly.Block, gen: any) {
    const sz = gen.valueToCode(block, 'SIZE', Order.ATOMIC) || '10';
    const b = block.getFieldValue('BASE') || '1';
    return `_p = list(range(${b}, ${sz} + ${b}))\nrandom.shuffle(_p)\nprint(*_p)\n`;
  };

  pythonGenerator.forBlock['cp_string'] = function (block: Blockly.Block, gen: any) {
    const len = gen.valueToCode(block, 'LENGTH', Order.ATOMIC) || '10';
    const cs = block.getFieldValue('CHARSET') || 'abcdefghijklmnopqrstuvwxyz';
    return `print("".join(random.choice("${cs}") for _ in range(${len})))\n`;
  };

  pythonGenerator.forBlock['cp_palindrome'] = function (block: Blockly.Block, gen: any) {
    const len = gen.valueToCode(block, 'LENGTH', Order.ATOMIC) || '10';
    const cs = block.getFieldValue('CHARSET') || 'abcdefghijklmnopqrstuvwxyz';
    return `_h = [random.choice("${cs}") for _ in range((${len}) // 2)]\n_m = [random.choice("${cs}")] if (${len}) % 2 != 0 else []\nprint("".join(_h + _m + _h[::-1]))\n`;
  };

  pythonGenerator.forBlock['cp_brackets'] = function (block: Blockly.Block, gen: any) {
    const len = gen.valueToCode(block, 'LENGTH', Order.ATOMIC) || '10';
    if (block.getFieldValue('BALANCED') !== 'TRUE') {
      return `print("".join(random.choice("()") for _ in range(${len})))\n`;
    }
    return `_n = (${len}) // 2\n_s = ['('] * _n + [')'] * _n\nrandom.shuffle(_s)\nprint("".join(_s))\n`;
  };

  pythonGenerator.forBlock['cp_tree_random'] = function (block: Blockly.Block, gen: any) {
    const v = gen.valueToCode(block, 'VERTICES', Order.ATOMIC) || '5';
    const b = block.getFieldValue('BASE') || '1';
    return `_n = ${v}\n_e = [(i, random.randint(${b}, i - 1)) for i in range(${b} + 1, _n + ${b})]\nrandom.shuffle(_e)\nfor _u, _v in _e:\n    print(_u, _v)\n`;
  };

  pythonGenerator.forBlock['cp_tree_bamboo'] = function (block: Blockly.Block, gen: any) {
    const v = gen.valueToCode(block, 'VERTICES', Order.ATOMIC) || '5';
    const b = block.getFieldValue('BASE') || '1';
    return `_nodes = list(range(${b}, ${v} + ${b}))\nrandom.shuffle(_nodes)\nfor _i in range(len(_nodes) - 1):\n    print(_nodes[_i], _nodes[_i+1])\n`;
  };

  pythonGenerator.forBlock['cp_tree_star'] = function (block: Blockly.Block, gen: any) {
    const v = gen.valueToCode(block, 'VERTICES', Order.ATOMIC) || '5';
    const b = block.getFieldValue('BASE') || '1';
    return `for _i in range(${b} + 1, ${v} + ${b}):\n    print(${b}, _i)\n`;
  };

  pythonGenerator.forBlock['cp_graph'] = function (block: Blockly.Block, gen: any) {
    const v = gen.valueToCode(block, 'VERTICES', Order.ATOMIC) || '5';
    const m = gen.valueToCode(block, 'EDGES', Order.ATOMIC) || '5';
    const b = block.getFieldValue('BASE') || '1';
    return `for _ in range(${m}):\n    print(random.randint(${b}, ${v} + ${b} - 1), random.randint(${b}, ${v} + ${b} - 1))\n`;
  };

  pythonGenerator.forBlock['cp_dag'] = function (block: Blockly.Block, gen: any) {
    const v = gen.valueToCode(block, 'VERTICES', Order.ATOMIC) || '5';
    const m = gen.valueToCode(block, 'EDGES', Order.ATOMIC) || '5';
    const b = block.getFieldValue('BASE') || '1';
    return `for _ in range(${m}):\n    _u = random.randint(${b}, ${v} + ${b} - 2)\n    print(_u, random.randint(_u + 1, ${v} + ${b} - 1))\n`;
  };

  pythonGenerator.forBlock['cp_grid'] = function (block: Blockly.Block, gen: any) {
    const r = gen.valueToCode(block, 'ROWS', Order.ATOMIC) || '3';
    const c = gen.valueToCode(block, 'COLS', Order.ATOMIC) || '3';
    const mn = gen.valueToCode(block, 'MIN', Order.ATOMIC) || '0';
    const mx = gen.valueToCode(block, 'MAX', Order.ATOMIC) || '1';
    return `for _ in range(${r}):\n    print(*[random.randint(${mn}, ${mx}) for _ in range(${c})])\n`;
  };

  pythonGenerator.forBlock['cp_grid_obstacles'] = function (block: Blockly.Block, gen: any) {
    const r = gen.valueToCode(block, 'ROWS', Order.ATOMIC) || '3';
    const c = gen.valueToCode(block, 'COLS', Order.ATOMIC) || '3';
    const d = block.getFieldValue('DENSITY') ?? 30;
    return `for _ in range(${r}):\n    print("".join('#' if random.randint(1, 100) <= ${d} else '.' for _ in range(${c})))\n`;
  };

  pythonGenerator.forBlock['cp_points_2d'] = function (block: Blockly.Block, gen: any) {
    const cnt = gen.valueToCode(block, 'COUNT', Order.ATOMIC) || '10';
    const mn = gen.valueToCode(block, 'MIN', Order.ATOMIC) || '-100';
    const mx = gen.valueToCode(block, 'MAX', Order.ATOMIC) || '100';
    return `for _ in range(${cnt}):\n    print(random.randint(${mn}, ${mx}), random.randint(${mn}, ${mx}))\n`;
  };

  pythonGenerator.forBlock['cp_range_query'] = function (block: Blockly.Block, gen: any) {
    const cnt = gen.valueToCode(block, 'COUNT', Order.ATOMIC) || '10';
    const n = gen.valueToCode(block, 'MAX_N', Order.ATOMIC) || '100';
    const b = block.getFieldValue('BASE') || '1';
    return `for _ in range(${cnt}):\n    _l = random.randint(${b}, ${n} + ${b} - 1)\n    print(_l, random.randint(_l, ${n} + ${b} - 1))\n`;
  };
};
