const { createJestConfig } = require("@studio/config/jest");

module.exports = createJestConfig({
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Ships as ES modules; its bundled build needs no transform.
    "^d3-hierarchy$": "<rootDir>/../../node_modules/d3-hierarchy/dist/d3-hierarchy.js",
  },
});
