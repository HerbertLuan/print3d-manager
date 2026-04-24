const nextJest = require('next/jest');

// Fornece a configuração base do Next.js para o Jest.
// Isso carrega o next.config.ts e os arquivos .env.* em ambiente de teste.
const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  // Arquivo de setup executado APÓS o framework de testes ser instalado
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Ambiente de testes: jsdom simula o DOM do browser
  testEnvironment: 'jest-environment-jsdom',

  // Resolve os aliases do tsconfig (@/* → src/*)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Patterns a ignorar
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],

  // Cobertura de código (opcional, rodar com --coverage)
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
  ],
};

// createJestConfig exporta uma função async para garantir que next/jest
// carregue as configs assíncronas do Next.js corretamente.
module.exports = createJestConfig(customJestConfig);
