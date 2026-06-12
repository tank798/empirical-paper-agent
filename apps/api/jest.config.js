module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@empirical/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@empirical/prompts$": "<rootDir>/../../packages/prompts/src/index.ts"
  }
};
