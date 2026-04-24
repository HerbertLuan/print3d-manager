// __mocks__/firebase/app.js
// Mock do módulo firebase/app
// Impede qualquer conexão real com o Firebase durante os testes.

const mockApp = { name: '[DEFAULT]', options: {}, automaticDataCollectionEnabled: false };

const getApps = jest.fn(() => []);
const getApp = jest.fn(() => mockApp);
const initializeApp = jest.fn(() => mockApp);

module.exports = {
  getApps,
  getApp,
  initializeApp,
};
