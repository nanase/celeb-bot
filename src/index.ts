import { Celebrator } from './celebrator.js';
import './console.js';

(async function main() {
  const bot = new Celebrator();
  bot.debugger = console;
  await bot.run();
})();
