import consoleStamp from 'console-stamp';
import { Celebrator } from './celebrator.js';

consoleStamp(console, { format: ':date(yyyy/mm/dd HH:MM:ss.l).green' });

(async function main() {
  const celebrator = new Celebrator();
  await celebrator.initialize();
  console.log('celeb_bot initialized');

  const controller = new AbortController();
  const { signal } = controller;
  let signalReceived = false;
  const tasks = () => [
    new Promise<string>(async (resolve, reject) => {
      signal.addEventListener('abort', reject, { once: true });
      await celebrator.loop();
      resolve('botTask');
    }),
    new Promise<string>((resolve, reject) => {
      signal.addEventListener('abort', reject, { once: true });
      process.on('SIGINT', (signal) => {
        signalReceived = true;
        console.log(`signal ${signal} received`);
        resolve(signal);
      });
    }),
  ];

  while (!signalReceived) {
    try {
      console.log('celeb_bot starting');
      const task = tasks();
      await Promise.race(task);
      await celebrator.abort();
      controller.abort();
    } catch (error) {
      console.error(error);
    }

    console.log('celeb_bot restart after 30 seconds');
    await new Promise((resolve) => setTimeout(resolve, 30000));
    continue;
  }

  await celebrator.deinitialize();
  console.log('celeb_bot deinitialized');

  if (signalReceived) {
    process.exit();
  }
})();
