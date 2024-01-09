import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import { Entity } from 'megalodon';

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

  add(milestone: number, account: Entity.Account, status: Entity.Status | Entity.ScheduledStatus) {
    if (typeof this.#storage[milestone] === 'undefined') {
      this.#storage[milestone] = [];
    }

    this.#storage[milestone].push({
      accountId: account.id,
      statusId: status.id,
      username: account.username,
      displayName: account.display_name,
      createdAt: dayjs().unix(),
    });
  }

  has(milestone: number, account: Entity.Account): boolean {
    if (typeof this.#storage[milestone] === 'undefined') {
      return false;
    }

    return this.#storage[milestone].findIndex((m) => m.accountId === account.id) >= 0;
  }
}
