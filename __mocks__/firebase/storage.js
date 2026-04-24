// __mocks__/firebase/storage.js
// Mock do módulo firebase/storage.
// Garante que uploads e downloads não disparem durante os testes.

const getStorage = jest.fn(() => ({}));
const ref = jest.fn(() => ({ fullPath: 'mock/path/image.jpg', name: 'image.jpg' }));
const uploadBytes = jest.fn(() => Promise.resolve({ ref: { fullPath: 'mock/path/image.jpg' } }));
const getDownloadURL = jest.fn(() => Promise.resolve('https://mock-storage.example.com/image.jpg'));
const deleteObject = jest.fn(() => Promise.resolve());

module.exports = {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
};
