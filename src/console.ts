import consoleStamp, { TokenPayload } from 'console-stamp';

consoleStamp(console, {
  format: ':date(yyyy/mm/dd HH:MM:ss.l).green :level',
  tokens: {
    level: (payload: TokenPayload) => {
      switch (payload.method) {
        case 'log':
          return `(LOG).green  `;
        case 'info':
          return `(INFO).green.underline `;
        case 'debug':
          return `(DEBUG).yellow.bold`;
        case 'warn':
          return `(WARN).yellow.bold.underline `;
        case 'error':
          return `(ERROR).red.bold.underline`;
        default:
          return `(${payload.method}).green`;
      }
    },
  },
});
