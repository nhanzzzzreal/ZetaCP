// src/components/StressTester/blocks/generatorService.ts

import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import { cppGenerator } from './cppGenerator';

const indentCode = (code: string, spaces = 4): string => {
  const pad = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => (line.trim() ? pad + line : ''))
    .join('\n');
};

const extractCodeString = (
  raw: string | [string, number] | undefined | null
): string => {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return raw[0] || '';
};

export const generateWorkspaceCode = (
  workspace: Blockly.Workspace,
  lang: 'python' | 'cpp'
): string => {
  const gen: any = lang === 'python' ? pythonGenerator : cppGenerator;
  if (typeof gen.init === 'function') {
    gen.init(workspace);
  }

  const topBlocks = workspace.getTopBlocks(true);
  const setupBlock = topBlocks.find((b) => b.type === 'setup_hat');
  const startBlock = topBlocks.find(
    (b) => b.type === 'when_start' || b.type === 'multitest_start'
  );
  const otherBlocks = topBlocks.filter(
    (b) => b !== setupBlock && b !== startBlock
  );

  const setupStr = setupBlock ? extractCodeString(gen.blockToCode(setupBlock)) : '';
  let bodyStr = startBlock ? extractCodeString(gen.blockToCode(startBlock)) : '';

  for (const block of otherBlocks) {
    const code = extractCodeString(gen.blockToCode(block));
    if (code) bodyStr += code;
  }

  if (lang === 'python') {
    let result = `import random\n\ndef gen_int(lo, hi):\n    return random.randint(lo, hi)\n\ndef gen_char(charset='abcdefghijklmnopqrstuvwxyz'):\n    return random.choice(charset)\n\ndef main():\n`;
    if (setupStr.trim()) {
      result += `    # --- Setup ---\n${indentCode(setupStr, 4)}\n`;
    }
    result += `    # --- Body ---\n`;
    if (bodyStr.trim()) {
      result += `${indentCode(bodyStr, 4)}\n`;
    } else {
      result += `    pass\n`;
    }
    result += `\nif __name__ == '__main__':\n    main()\n`;
    return result;
  }

  let result = `#include "testlib.h"\n#include <iostream>\nusing namespace std;\n\nint main(int argc, char* argv[]) {\n    registerGen(argc, argv, 1);\n\n`;
  if (setupStr.trim()) {
    result += `    // Setup\n${indentCode(setupStr, 4)}\n`;
  }
  result += `    // Body\n`;
  if (bodyStr.trim()) {
    result += `${indentCode(bodyStr, 4)}\n`;
  }
  result += `    return 0;\n}\n`;
  return result;
};
