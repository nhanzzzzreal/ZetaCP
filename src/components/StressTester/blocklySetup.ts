// src/components/StressTester/blocklySetup.ts

import 'blockly/blocks';
import { registerHatBlocks } from './blocks/hatBlocks';
import { registerConvenienceBlocks } from './blocks/convenienceBlocks';
import { registerPrimitiveBlocks } from './blocks/primitiveBlocks';
import { registerIOBlocks } from './blocks/ioBlocks';
import { getToolboxConfig } from './blocks/toolbox';

export { getToolboxConfig };

export const registerCustomBlocks = (): void => {
  registerHatBlocks();
  registerConvenienceBlocks();
  registerPrimitiveBlocks();
  registerIOBlocks();
};
