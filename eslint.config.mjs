import baseConfig from './packages/eslint-config/base.mjs';
import nodeConfig from './packages/eslint-config/node.mjs';

export default [...baseConfig, ...nodeConfig];
