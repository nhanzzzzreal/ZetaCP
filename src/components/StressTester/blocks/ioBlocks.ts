// src/components/StressTester/blocks/ioBlocks.ts

import * as Blockly from 'blockly';
import { pythonGenerator, Order } from 'blockly/python';

interface VariadicBlock extends Blockly.Block {
  itemCount_: number;
  updateShape_: () => void;
}

class FieldClickable extends Blockly.FieldLabel {
  private onClickFn: () => void;
  constructor(text: string, onClickFn: () => void) {
    super(text);
    this.onClickFn = onClickFn;
    (this as unknown as { CURSOR: string }).CURSOR = 'pointer';
  }
  override showEditor_(): void {
    if (this.onClickFn) {
      this.onClickFn();
    }
  }
}

const setupVariadicBlock = (
  block: VariadicBlock,
  inputPrefix: string
) => {
  block.updateShape_ = function (this: VariadicBlock) {
    // Ensure inputs VAL0..VAL{itemCount_-1} exist
    for (let i = 0; i < this.itemCount_; i++) {
      const inputName = inputPrefix + i;
      let input = this.getInput(inputName);
      if (!input) {
        input = this.appendValueInput(inputName);
        // Auto-attach math_number shadow block for instant hand typing
        if (input && input.connection && !input.connection.targetBlock() && this.workspace) {
          try {
            const shadowBlock = this.workspace.newBlock('math_number') as Blockly.BlockSvg;
            shadowBlock.setShadow(true);
            if (typeof shadowBlock.initSvg === 'function') shadowBlock.initSvg();
            if (typeof shadowBlock.render === 'function') shadowBlock.render();
            const conn = (shadowBlock as any).outputConnection;
            if (conn && input.connection) {
              input.connection.connect(conn);
            }
          } catch (e) {
            console.error('Shadow attach error:', e);
          }
        }
      }
    }
    // Remove extra inputs if itemCount_ decreased
    let i = this.itemCount_;
    while (this.getInput(inputPrefix + i)) {
      this.removeInput(inputPrefix + i);
      i++;
    }

    // Move control buttons to the end if present
    if (this.getInput('BUTTONS')) {
      this.moveInputBefore('BUTTONS', null);
    }
  };
};

export const registerIOBlocks = () => {
  // 1. print_val: space-separated output on same line
  delete Blockly.Blocks['print_val'];
  Blockly.Blocks['print_val'] = {
    itemCount_: 1,
    init: function (this: VariadicBlock) {
      this.itemCount_ = 1;
      this.setColour('#3B82F6');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setTooltip('Prints values separated by spaces without newline.');

      this.appendDummyInput('HEADER').appendField('print');
      setupVariadicBlock(this, 'VAL');
      this.updateShape_();

      const buttonsInput = this.appendDummyInput('BUTTONS');
      buttonsInput.appendField(
        new FieldClickable(' [+] ', () => {
          this.itemCount_++;
          this.updateShape_();
        })
      );
      buttonsInput.appendField(
        new FieldClickable(' [-] ', () => {
          if (this.itemCount_ > 1) {
            this.itemCount_--;
            this.updateShape_();
          }
        })
      );
    },
    saveExtraState: function (this: VariadicBlock) {
      return { itemCount: this.itemCount_ };
    },
    loadExtraState: function (this: VariadicBlock, state: any) {
      this.itemCount_ = state.itemCount ?? 1;
      this.updateShape_();
    },
    mutationToDom: function (this: VariadicBlock) {
      const container = Blockly.utils.xml.createElement('mutation');
      container.setAttribute('items', String(this.itemCount_));
      return container;
    },
    domToMutation: function (this: VariadicBlock, xmlElement: Element) {
      this.itemCount_ = parseInt(xmlElement.getAttribute('items') || '1', 10);
      this.updateShape_();
    },
  };

  pythonGenerator.forBlock['print_val'] = function (
    block: Blockly.Block,
    generator: any
  ) {
    const b = block as VariadicBlock;
    const count = b.itemCount_ || 1;
    const vals: string[] = [];
    for (let i = 0; i < count; i++) {
      const val = generator.valueToCode(block, 'VAL' + i, Order.ATOMIC) || '""';
      vals.push(val);
    }
    if (vals.length === 0) {
      return 'print(end=" ")\n';
    }
    return `print(${vals.join(', ')}, end=" ")\n`;
  };

  // 2. println_val: space-separated output with newline
  delete Blockly.Blocks['println_val'];
  Blockly.Blocks['println_val'] = {
    itemCount_: 1,
    init: function (this: VariadicBlock) {
      this.itemCount_ = 1;
      this.setColour('#3B82F6');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setTooltip('Prints values separated by spaces followed by a newline.');

      this.appendDummyInput('HEADER').appendField('println');
      setupVariadicBlock(this, 'VAL');
      this.updateShape_();

      const buttonsInput = this.appendDummyInput('BUTTONS');
      buttonsInput.appendField(
        new FieldClickable(' [+] ', () => {
          this.itemCount_++;
          this.updateShape_();
        })
      );
      buttonsInput.appendField(
        new FieldClickable(' [-] ', () => {
          if (this.itemCount_ > 0) {
            this.itemCount_--;
            this.updateShape_();
          }
        })
      );
    },
    saveExtraState: function (this: VariadicBlock) {
      return { itemCount: this.itemCount_ };
    },
    loadExtraState: function (this: VariadicBlock, state: any) {
      this.itemCount_ = state.itemCount ?? 1;
      this.updateShape_();
    },
    mutationToDom: function (this: VariadicBlock) {
      const container = Blockly.utils.xml.createElement('mutation');
      container.setAttribute('items', String(this.itemCount_));
      return container;
    },
    domToMutation: function (this: VariadicBlock, xmlElement: Element) {
      this.itemCount_ = parseInt(xmlElement.getAttribute('items') || '1', 10);
      this.updateShape_();
    },
  };

  pythonGenerator.forBlock['println_val'] = function (
    block: Blockly.Block,
    generator: any
  ) {
    const b = block as VariadicBlock;
    const count = b.itemCount_ !== undefined ? b.itemCount_ : 1;
    const vals: string[] = [];
    for (let i = 0; i < count; i++) {
      const val = generator.valueToCode(block, 'VAL' + i, Order.ATOMIC) || '""';
      vals.push(val);
    }
    if (vals.length === 0) {
      return 'print()\n';
    }
    return `print(${vals.join(', ')})\n`;
  };
};
