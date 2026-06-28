// src/components/StressTester/blocks/hatBlocks.ts

import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';

/**
 * Register Hat blocks and Setup/Variable blocks for ZetaCP Generator Canvas.
 */
export const registerHatBlocks = (): void => {
  // Override scrub_ to avoid double-generating chained blocks
  (pythonGenerator as any).scrub_ = function (
    block: Blockly.Block,
    code: string,
    thisOnly?: boolean
  ): string {
    if (block.type === 'multitest_start') return code;
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    if (nextBlock && !thisOnly) {
      return code + pythonGenerator.blockToCode(nextBlock);
    }
    return code;
  };

  // ── 1. Hat-block: when Start ─────────────────────────────────────
  delete Blockly.Blocks['when_start'];
  Blockly.Blocks['when_start'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('when Start            \u00A0');
      this.setColour('#4F46E5');
      this.setNextStatement(true, null);
      this.setTooltip('Main execution entry point for generator canvas.');
      (this as any).hat = 'cap';
    },
  };
  pythonGenerator.forBlock['when_start'] = () => '';

  // ── 2. Hat-block: setup ──────────────────────────────────────────
  delete Blockly.Blocks['setup_hat'];
  Blockly.Blocks['setup_hat'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('setup                 \u00A0');
      this.setColour('#F59E0B');
      this.setNextStatement(true, null);
      this.setTooltip('Independent setup block for variable initializations.');
      (this as any).hat = 'cap';
    },
  };
  pythonGenerator.forBlock['setup_hat'] = () => '';

  // ── 3. Stack-block: call setup ───────────────────────────────────
  delete Blockly.Blocks['call_setup'];
  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'call_setup',
      message0: 'call setup',
      previousStatement: null,
      nextStatement: null,
      colour: '#F59E0B',
      tooltip: 'Calls the setup block to initialize variables.',
      helpUrl: '',
    },
  ]);
  pythonGenerator.forBlock['call_setup'] = () => '# setup call\n';

  // ── 4. Stack-block: set [var] ← (expr) ──────────────────────────
  delete Blockly.Blocks['set_variable'];
  Blockly.Blocks['set_variable'] = {
    init(this: Blockly.BlockSvg) {
      this.appendDummyInput()
        .appendField('set ')
        .appendField(new Blockly.FieldVariable('%{BKY_VARIABLES_DEFAULT_NAME}'), 'VAR')
        .appendField(' ←');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour('#F59E0B');
      this.setTooltip('Assigns an expression value to a variable.');

      const valConn = this.getInput('VALUE')?.connection;
      if (valConn && typeof (valConn as any).setShadowState === 'function') {
        (valConn as any).setShadowState({
          type: 'math_number',
          fields: { NUM: 10 },
        });
      }
    },
  };

  pythonGenerator.forBlock['set_variable'] = function (
    block: Blockly.Block,
    generator: unknown
  ): string {
    const gen = generator as {
      getVariableName?: (id: string) => string;
      valueToCode: (b: Blockly.Block, name: string, order: number) => string;
    };
    const varId = block.getFieldValue('VAR');
    const varName =
      typeof gen.getVariableName === 'function' ? gen.getVariableName(varId) : varId;
    const value = gen.valueToCode(block, 'VALUE', 0) || 'None';
    return `${varName} = ${value}\n`;
  };

  // Standard variables_set & variables_get compatibility
  delete Blockly.Blocks['variables_set'];
  Blockly.Blocks['variables_set'] = Blockly.Blocks['set_variable'];
  pythonGenerator.forBlock['variables_set'] = pythonGenerator.forBlock['set_variable'];

  delete Blockly.Blocks['variables_get'];
  Blockly.Blocks['variables_get'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldVariable('%{BKY_VARIABLES_DEFAULT_NAME}'), 'VAR');
      this.setOutput(true, null);
      this.setColour('#F59E0B');
      this.setTooltip('Returns the value of a variable.');
    },
  };
  pythonGenerator.forBlock['variables_get'] = function (block: Blockly.Block, generator: any) {
    const varId = block.getFieldValue('VAR');
    const varName = typeof generator.getVariableName === 'function' ? generator.getVariableName(varId) : varId;
    return [varName, 0];
  };

  // ── 5. Hat-block: Multitest Start ───────────────────────────────
  delete Blockly.Blocks['multitest_start'];
  Blockly.Blocks['multitest_start'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TEST_COUNT')
        .setCheck('Number')
        .appendField('multitest T =');
      this.appendDummyInput().appendField('           \u00A0');
      this.setInputsInline(true);
      this.setColour('#4F46E5');
      this.setNextStatement(true, null);
      this.setTooltip('Starting block for multitest generator. T is the test count variable.');
      (this as any).hat = 'cap';
    },
  };
  pythonGenerator.forBlock['multitest_start'] = function (
    block: Blockly.Block,
    generator: unknown
  ): string {
    const gen = generator as {
      valueToCode: (b: Blockly.Block, name: string, order: number) => string;
      blockToCode: (b: Blockly.Block, thisOnly?: boolean) => string;
    };
    const testCount = gen.valueToCode(block, 'TEST_COUNT', 0) || '10';
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const body = nextBlock ? gen.blockToCode(nextBlock, true) : '';
    const indented = body
      .split('\n')
      .map((line: string) => (line ? '    ' + line : ''))
      .join('\n');
    return `print(${testCount})\nfor _ in range(${testCount}):\n${indented}`;
  };
};
