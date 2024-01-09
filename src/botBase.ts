import * as dotenv from 'dotenv';
import { Mastodon, type MegalodonInterface, WebSocketInterface, Entity, Response } from 'megalodon';

class BotClient {
  constructor(readonly rest: MegalodonInterface, readonly streaming: WebSocketInterface) {}
}

export abstract class BotBase {
  protected readonly env: dotenv.DotenvParseOutput;
  protected readonly client: BotClient;

  constructor() {
    const config = dotenv.config();

    if (config.error) {
      throw config.error;
    }

    if (!config.parsed) {
      throw new Error('.env is empty');
    }

    this.env = config.parsed;
    const client = new Mastodon(this.env.MASTODON_SERVER, this.env.MASTODON_ACCESS_TOKEN);
    const streamingClient = new Mastodon(this.env.MASTODON_STREAMING_API_URL, this.env.MASTODON_ACCESS_TOKEN);
    const streaming = streamingClient.localSocket();

    this.client = new BotClient(client, streaming);
  }

  protected async initialize(): Promise<void> {}
  protected async onUpdate(_event: Entity.Status): Promise<void> {}
  protected async onReceiveNotification(_notification: Entity.Notification): Promise<void> {}
  protected async onDelete(_id: number): Promise<void> {}
  protected async deinitialize(): Promise<void> {}

  public async run() {
    await this.initialize();
    const controller = new AbortController();
    const { signal } = controller;
    let signalReceived = false;
    const tasks = () => [
      new Promise<string>(async (resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => {
            this.client.streaming.stop();
            reject();
          },
          { once: true }
        );
        await this.preprocess();
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
        console.log('starting');
        const task = tasks();
        await Promise.race(task);
        controller.abort();

        if (!signalReceived) {
          console.log('restart after 10 seconds');
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      } catch (error) {
        console.error(error);
      }
    }

    await this.deinitialize();

    if (signalReceived) {
      process.exit();
    }
  }

  private async preprocess() {
    this.client.streaming.removeAllListeners();

    return new Promise<void>((resolve) => {
      this.client.streaming.on('connect', () => {
        console.log('connect');
      });

      this.client.streaming.on('update', async (status: Entity.Status) => {
        await this.onUpdate(status);
      });

      this.client.streaming.on('notification', async (notification: Entity.Notification) => {
        await this.onReceiveNotification(notification);
      });

      this.client.streaming.on('delete', async (id: number) => {
        await this.onDelete(id);
      });

      this.client.streaming.on('error', (err: Error) => {
        console.error(err);
      });

      this.client.streaming.on('close', () => {
        console.log('close');
        resolve();
      });

      this.client.streaming.on('parser-error', (err: Error) => {
        console.error(err);
      });
    });
  }
}
