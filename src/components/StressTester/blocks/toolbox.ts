// src/components/StressTester/blocks/toolbox.ts

const makeShadow = (num: number) => ({
  shadow: {
    type: 'math_number',
    fields: {
      NUM: num,
    },
  },
});

export const getToolboxConfig = () => {
  return {
    kind: 'categoryToolbox',
    contents: [
      {
        kind: 'category',
        name: 'Structure',
        colour: '#4F46E5',
        contents: [
          { kind: 'block', type: 'when_start' },
          { kind: 'block', type: 'setup_hat' },
          { kind: 'block', type: 'call_setup' },
          {
            kind: 'block',
            type: 'multitest_start',
            inputs: {
              TEST_COUNT: makeShadow(10),
            },
          },
        ],
      },
      {
        kind: 'category',
        name: 'Primitives',
        colour: '#10B981',
        contents: [
          {
            kind: 'block',
            type: 'randInt',
            inputs: {
              L: makeShadow(1),
              R: makeShadow(100),
            },
          },
          {
            kind: 'block',
            type: 'randRange',
            inputs: {
              LMIN: makeShadow(1),
              LMAX: makeShadow(10),
              RMIN: makeShadow(10),
              RMAX: makeShadow(100),
            },
          },
          { kind: 'block', type: 'randChar' },
          {
            kind: 'block',
            type: 'randFloat',
            inputs: {
              L: makeShadow(0),
              R: makeShadow(1),
            },
          },
        ],
      },
      {
        kind: 'category',
        name: 'Variables',
        colour: '#F59E0B',
        custom: 'VARIABLE',
      },
      {
        kind: 'category',
        name: 'Output',
        colour: '#3B82F6',
        contents: [
          { kind: 'block', type: 'print_val' },
          { kind: 'block', type: 'println_val' },
        ],
      },
      {
        kind: 'category',
        name: 'Control',
        colour: '#EC4899',
        contents: [
          {
            kind: 'block',
            type: 'controls_repeat_ext',
            inputs: {
              TIMES: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'controls_for',
            inputs: {
              FROM: makeShadow(1),
              TO: makeShadow(10),
              BY: makeShadow(1),
            },
          },
          { kind: 'block', type: 'controls_whileUntil' },
          { kind: 'block', type: 'controls_if' },
        ],
      },
      {
        kind: 'category',
        name: 'Math',
        colour: '#8B5CF6',
        contents: [
          { kind: 'block', type: 'math_number' },
          {
            kind: 'block',
            type: 'math_arithmetic',
            inputs: {
              A: makeShadow(1),
              B: makeShadow(1),
            },
          },
          {
            kind: 'block',
            type: 'math_modulo',
            inputs: {
              DIVIDEND: makeShadow(64),
              DIVISOR: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'math_single',
            inputs: {
              NUM: makeShadow(9),
            },
          },
          { kind: 'block', type: 'math_on_list' },
        ],
      },
      {
        kind: 'category',
        name: 'List & Sequence',
        colour: '#6366F1',
        contents: [
          {
            kind: 'block',
            type: 'cp_array',
            inputs: {
              SIZE: makeShadow(10),
              MIN: makeShadow(1),
              MAX: makeShadow(100),
            },
          },
          {
            kind: 'block',
            type: 'cp_sorted_array',
            inputs: {
              SIZE: makeShadow(10),
              MIN: makeShadow(1),
              MAX: makeShadow(100),
            },
          },
          {
            kind: 'block',
            type: 'cp_permutation',
            inputs: {
              SIZE: makeShadow(10),
            },
          },
        ],
      },
      {
        kind: 'category',
        name: 'Strings',
        colour: '#A855F7',
        contents: [
          {
            kind: 'block',
            type: 'cp_string',
            inputs: {
              LENGTH: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'cp_palindrome',
            inputs: {
              LENGTH: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'cp_brackets',
            inputs: {
              LENGTH: makeShadow(10),
            },
          },
        ],
      },
      {
        kind: 'category',
        name: 'Trees & Graphs',
        colour: '#06B6D4',
        contents: [
          {
            kind: 'block',
            type: 'cp_tree_random',
            inputs: {
              VERTICES: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'cp_tree_bamboo',
            inputs: {
              VERTICES: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'cp_tree_star',
            inputs: {
              VERTICES: makeShadow(10),
            },
          },
          {
            kind: 'block',
            type: 'cp_graph',
            inputs: {
              VERTICES: makeShadow(10),
              EDGES: makeShadow(15),
            },
          },
          {
            kind: 'block',
            type: 'cp_dag',
            inputs: {
              VERTICES: makeShadow(10),
              EDGES: makeShadow(15),
            },
          },
        ],
      },
      {
        kind: 'category',
        name: 'Geometry & Grid',
        colour: '#14B8A6',
        contents: [
          {
            kind: 'block',
            type: 'cp_grid',
            inputs: {
              ROWS: makeShadow(5),
              COLS: makeShadow(5),
              MIN: makeShadow(0),
              MAX: makeShadow(1),
            },
          },
          {
            kind: 'block',
            type: 'cp_grid_obstacles',
            inputs: {
              ROWS: makeShadow(5),
              COLS: makeShadow(5),
            },
          },
          {
            kind: 'block',
            type: 'cp_points_2d',
            inputs: {
              COUNT: makeShadow(10),
              MIN: makeShadow(1),
              MAX: makeShadow(100),
            },
          },
          {
            kind: 'block',
            type: 'cp_range_query',
            inputs: {
              COUNT: makeShadow(10),
              MAX_N: makeShadow(100),
            },
          },
        ],
      },
    ],
  };
};
