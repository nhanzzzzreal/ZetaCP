// src/components/StressTester/blocks/primitiveBlocks.ts

import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

/** Custom field that creates a Blockly variable only when the user
 *  finishes editing (Enter / blur), NOT on every keystroke. */
class SmartNumberField extends Blockly.FieldTextInput {
  constructor(value?: string) {
    super(value ?? '0');
  }

  override onFinishEditing_(finalValue: string) {
    const trimmed = (finalValue ?? '').trim();
    const isVarName =
      trimmed &&
      /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed) &&
      !/^(true|false|null|undefined|None|\d+)$/i.test(trimmed);

    if (!isVarName) return;

    const sourceBlock = this.getSourceBlock();
    const ws = (sourceBlock ? sourceBlock.workspace : null) ||
      (window as unknown as { activeBlocklyWorkspace: Blockly.WorkspaceSvg | null }).activeBlocklyWorkspace;

    if (!ws || (ws as any).isFlyout) return;

    const win = window as any;
    if (typeof win.handleSmartVariableCreation === 'function') {
      win.handleSmartVariableCreation(trimmed);
    } else {
      const map = ws.getVariableMap();
      const existing = map.getVariable(trimmed, '');
      if (!existing) {
        map.createVariable(trimmed);
      }
    }
  }
}

export const registerPrimitiveBlocks = () => {
  delete Blockly.Blocks['math_number'];
  Blockly.Blocks['math_number'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new SmartNumberField('0'), 'NUM');
      this.setOutput(true, null);
      this.setColour('#10B981');
    },
  };

  pythonGenerator.forBlock['math_number'] = function (block: Blockly.Block): [string, number] {
    const val = block.getFieldValue('NUM') || '0';
    return [val, Order.ATOMIC];
  };

  // 1. randInt(L, R)
  delete Blockly.Blocks['randInt'];
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'randInt',
      message0: 'randInt %1 .. %2',
      args0: [
        {
          type: 'input_value',
          name: 'L',
        },
        {
          type: 'input_value',
          name: 'R',
        },
      ],
      inputsInline: true,
      output: null,
      colour: '#10B981',
      tooltip: 'Generate a random integer between L and R inclusive',
      helpUrl: '',
    },
  ]);

  pythonGenerator.forBlock['randInt'] = function (block: Blockly.Block, generator: any) {
    const l = generator.valueToCode(block, 'L', Order.ATOMIC) || '1';
    const r = generator.valueToCode(block, 'R', Order.ATOMIC) || '100';
    return [`random.randint(${l}, ${r})`, Order.FUNCTION_CALL];
  };

  // 2. randRange(Lmin, Lmax, Rmin, Rmax)
  delete Blockly.Blocks['randRange'];
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'randRange',
      message0: 'randRange L ∈ [%1 .. %2]  R ∈ [%3 .. %4]',
      args0: [
        {
          type: 'input_value',
          name: 'LMIN',
        },
        {
          type: 'input_value',
          name: 'LMAX',
        },
        {
          type: 'input_value',
          name: 'RMIN',
        },
        {
          type: 'input_value',
          name: 'RMAX',
        },
      ],
      inputsInline: true,
      output: null,
      colour: '#10B981',
      tooltip: 'Generate a random range (L, R)',
      helpUrl: '',
    },
  ]);

  pythonGenerator.forBlock['randRange'] = function (block: Blockly.Block, generator: any) {
    const lmin = generator.valueToCode(block, 'LMIN', Order.ATOMIC) || '1';
    const lmax = generator.valueToCode(block, 'LMAX', Order.ATOMIC) || '10';
    const rmin = generator.valueToCode(block, 'RMIN', Order.ATOMIC) || '10';
    const rmax = generator.valueToCode(block, 'RMAX', Order.ATOMIC) || '100';
    const code = `f"{random.randint(${lmin}, ${lmax})} {random.randint(${rmin}, ${rmax})"`;
    return [code, Order.ATOMIC];
  };

  // 3. randChar(charset)
  delete Blockly.Blocks['randChar'];
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'randChar',
      message0: 'randChar %1',
      args0: [
        {
          type: 'field_dropdown',
          name: 'CHARSET',
          options: [
            ['a-z', 'a-z'],
            ['A-Z', 'A-Z'],
            ['0-9', '0-9'],
            ['a-zA-Z', 'a-zA-Z'],
            ['a-zA-Z0-9', 'a-zA-Z0-9'],
          ],
        },
      ],
      inputsInline: true,
      output: null,
      colour: '#10B981',
      tooltip: 'Generate a random character from the selected charset',
      helpUrl: '',
    },
  ]);

  pythonGenerator.forBlock['randChar'] = function (block: Blockly.Block, _generator: any) {
    const charset = block.getFieldValue('CHARSET') || 'a-z';
    let pool = 'abcdefghijklmnopqrstuvwxyz';
    if (charset === 'A-Z') {
      pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    } else if (charset === '0-9') {
      pool = '0123456789';
    } else if (charset === 'a-zA-Z') {
      pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    } else if (charset === 'a-zA-Z0-9') {
      pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    }
    return [`random.choice("${pool}")`, Order.FUNCTION_CALL];
  };

  // 4. randFloat(L, R)
  delete Blockly.Blocks['randFloat'];
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'randFloat',
      message0: 'randFloat %1 .. %2 (dec: %3)',
      args0: [
        {
          type: 'input_value',
          name: 'L',
        },
        {
          type: 'input_value',
          name: 'R',
        },
        {
          type: 'field_number',
          name: 'DECIMALS',
          value: 3,
          min: 1,
          max: 9,
          precision: 1,
        },
      ],
      inputsInline: true,
      output: null,
      colour: '#10B981',
      tooltip: 'Generate a random floating point number between L and R',
      helpUrl: '',
    },
  ]);

  pythonGenerator.forBlock['randFloat'] = function (block: Blockly.Block, generator: any) {
    const l = generator.valueToCode(block, 'L', Order.ATOMIC) || '0.0';
    const r = generator.valueToCode(block, 'R', Order.ATOMIC) || '1.0';
    const decimals = block.getFieldValue('DECIMALS') || 3;
    return [`round(random.uniform(${l}, ${r}), ${decimals})`, Order.FUNCTION_CALL];
  };
};
