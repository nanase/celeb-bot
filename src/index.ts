import consoleStamp from 'console-stamp';
import { Celebrator } from './celebrator.js';

consoleStamp(console, { format: ':date(yyyy/mm/dd HH:MM:ss.l).green' });

(async function main() {
  await new Celebrator().run();
})();
