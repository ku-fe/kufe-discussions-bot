import { App } from './App.js';

const app = App.getInstance();

app.start().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
