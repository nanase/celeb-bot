import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import { mastodon } from 'masto';

interface MilestoneLoggerStorageItem {
  accountId: string;
  statusId: string;
  username: string;
  displayName: string;
  createdAt: number;
}

export class MilestoneLogger {
  #storage: Record<number, MilestoneLoggerStorageItem[]> = {};

  async load(path: string) {
    this.#storage = JSON.parse((await fs.readFile(path)).toString());
  }

  async save(path: string) {
    await fs.writeFile(path, JSON.stringify(this.#storage, null, 2));
  }

  add(milestone: number, account: mastodon.v1.Account, status: mastodon.v1.Status) {
    if (typeof this.#storage[milestone] === 'undefined') {
      this.#storage[milestone] = [];
    }

    this.#storage[milestone].push({
      accountId: account.id,
      statusId: status.id,
      username: account.username,
      displayName: account.displayName,
      createdAt: dayjs().unix(),
    });
  }

  has(milestone: number, account: mastodon.v1.Account): boolean {
    if (typeof this.#storage[milestone] === 'undefined') {
      return false;
    }

    return this.#storage[milestone].findIndex((m) => m.accountId === account.id) >= 0;
  }
}
