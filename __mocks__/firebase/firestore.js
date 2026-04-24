// __mocks__/firebase/firestore.js
// Mock completo do módulo firebase/firestore.
// Todas as funções de leitura/escrita são jest.fn() que retornam dados fictícios
// estruturados para que os componentes renderizem sem falhas de conexão.

// --- Objetos fictícios reutilizados ---

const mockTimestamp = {
  seconds: 1700000000,
  nanoseconds: 0,
  toDate: () => new Date('2023-11-14T22:13:20.000Z'),
  toMillis: () => 1700000000000,
};

const makeFakeDoc = (id, data) => ({
  id,
  data: () => data,
  exists: () => true,
  ref: { id, path: `collection/${id}` },
});

const makeFakeSnapshot = (docs = []) => ({
  docs,
  empty: docs.length === 0,
  size: docs.length,
  forEach: (cb) => docs.forEach(cb),
});

// --- Mocks das funções ---

const collection = jest.fn(() => ({ id: 'mock-collection' }));
const doc = jest.fn((db, col, id) => ({ id: id || 'mock-doc-id', path: `${col}/${id || 'mock-doc-id'}` }));
const query = jest.fn((...args) => args[0]);
const orderBy = jest.fn();
const where = jest.fn();
const limit = jest.fn();

// Retorna um snapshot vazio por padrão; pode ser sobrescrito em cada teste com mockResolvedValueOnce
const getDocs = jest.fn(() => Promise.resolve(makeFakeSnapshot([])));

// Retorna uma referência fictícia com o id gerado
const addDoc = jest.fn(() => Promise.resolve({ id: 'new-mock-doc-id' }));

const updateDoc = jest.fn(() => Promise.resolve());
const deleteDoc = jest.fn(() => Promise.resolve());
const setDoc = jest.fn(() => Promise.resolve());

// serverTimestamp retorna o mock de Timestamp para consistência
const serverTimestamp = jest.fn(() => mockTimestamp);

// runTransaction executa o callback com um transaction mock
const runTransaction = jest.fn(async (db, updateFn) => {
  const transaction = {
    get: jest.fn(() => Promise.resolve(makeFakeDoc('mock-id', { quantity_available: 10, consumed_weight_grams: 0 }))),
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return updateFn(transaction);
});

const getFirestore = jest.fn(() => ({}));

// Timestamp class mock
class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() {
    return new Date(this.seconds * 1000);
  }
  toMillis() {
    return this.seconds * 1000;
  }
  static fromDate(date) {
    return new Timestamp(Math.floor(date.getTime() / 1000), 0);
  }
  static now() {
    return new Timestamp(Math.floor(Date.now() / 1000), 0);
  }
}

module.exports = {
  collection,
  doc,
  query,
  orderBy,
  where,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  runTransaction,
  getFirestore,
  Timestamp,
  // Exporta helpers para uso nos testes
  __helpers: { makeFakeDoc, makeFakeSnapshot, mockTimestamp },
};
