// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill Node globals for Jest JSDOM environment
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Compatibility shim for Jest with React Router v7 subpath exports
try {
  jest.mock('react-router/dom', () => require('react-router/dist/development/dom-export.js'), { virtual: true });
} catch (e) {
  // ignore
}

// Mock WebGL canvas based Spline library in Node / Jest environment
try {
  jest.mock('@splinetool/react-spline', () => {
    return function DummySpline() {
      return null;
    };
  }, { virtual: true });
} catch (e) {
  // ignore
}
