import * as dotenv from 'dotenv';
import { createStreamingAPIClient, createRestAPIClient, mastodon } from 'masto';

export abstract class BotBase {
  protected env: dotenv.DotenvParseOutput;
  protected streaming: mastodon.streaming.Client;
  protected masto: mastodon.rest.Client;
  private subscription: mastodon.streaming.Subscription | null;
  private subscriptionNumber: number;

  constructor() {
    this.subscription = null;
    this.subscriptionNumber = -1;
    const config = dotenv.config();

    if (config.error) {
      throw config.error;
    }

    if (!config.parsed) {
      throw new Error('.env is empty');
    }

    this.env = config.parsed;
    this.streaming = createStreamingAPIClient({
      streamingApiUrl: this.env.MASTODON_STREAMING_API_URL ?? '',
      accessToken: this.env.MASTODON_ACCESS_TOKEN ?? '',
    });
    this.masto = createRestAPIClient({
      url: this.env.MASTODON_SERVER ?? '',
      accessToken: this.env.MASTODON_ACCESS_TOKEN ?? '',
    });
  }

  protected abstract initialize(): Promise<void>;
  protected abstract process(event: mastodon.streaming.Event): Promise<void>;
  protected abstract deinitialize(): Promise<void>;

  public async run() {
    await this.initialize();
    const controller = new AbortController();
    const { signal } = controller;
    let signalReceived = false;
    const tasks = () => [
      new Promise<string>(async (resolve, reject) => {
        signal.addEventListener('abort', reject, { once: true });
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
        await this.abort();
        controller.abort();

        if (!signalReceived) {
          console.log('restart after 30 seconds');
          await new Promise((resolve) => setTimeout(resolve, 30000));
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

  private async abort() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      console.log('socket: public local is unsubscribed');
      this.subscription = null;
    }
  }

  private async preprocess() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      console.log('socket: public local is unsubscribed');
    }

    const subscriptionNumber = ++this.subscriptionNumber;
    this.subscription = this.streaming.public.local.subscribe();
    console.log('socket: public local is subscribed');

    for await (const event of this.subscription) {
      if (subscriptionNumber !== this.subscriptionNumber) {
        break;
      }

      await this.process(event);
    }

    console.log('break');
  }
}
