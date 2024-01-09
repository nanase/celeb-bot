import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import { mastodon } from 'masto';

import { withCommas } from './lib/number.js';
import { MilestoneLogger } from './milestoneLogger.js';
import { BotBase } from './botBase.js';

const milestoneLoggerPath = './data/milestone_log.json';
const milestones = [
  100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000,
  5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000,
];

export class Celebrator extends BotBase {
  private milestoneLogger: MilestoneLogger;

  constructor() {
    super();
    this.milestoneLogger = new MilestoneLogger();
  }

  protected override async initialize() {
    if (
      await fs
        .access(milestoneLoggerPath, fs.constants.F_OK)
        .then(() => true)
        .catch(() => false)
    ) {
      await this.milestoneLogger.load(milestoneLoggerPath);
    }

    console.log('celeb_bot initialized');
  }

  protected override async process(event: mastodon.streaming.Event) {
    switch (event.event) {
      case 'update': {
        console.log(
          `${event.payload.account.username}: ${event.payload.account.statusesCount} (${
            (milestones
              .filter((m) => m > event.payload.account.statusesCount)
              .sort((a, b) => a - b)
              .at(0) ?? 0) - event.payload.account.statusesCount
          })`
        );
        await this.celebrate(event.payload.account);
        break;
      }
      default: {
        break;
      }
    }
  }

  protected override async deinitialize() {
    await this.milestoneLogger.save(milestoneLoggerPath);
    console.log('celeb_bot deinitialized');
  }

  private async celebrate(account: mastodon.v1.Account): Promise<void> {
    if (account.id === this.env.MASTODON_SELF_BOT_ID ?? '') {
      return;
    }

    if (account.statusesCount === 1) {
      await this.celebrateNewFriends(account);
    }

    if (milestones.indexOf(account.statusesCount) !== -1) {
      await this.celebrateMilestone(account, account.statusesCount);
    }
  }

  private async celebrateNewFriends(account: mastodon.v1.Account): Promise<void> {
    if (this.milestoneLogger.has(1, account)) {
      return;
    }

    const accountCreatedDayDiff = dayjs().diff(dayjs(account.createdAt), 'd');
    let text = `新フレンズの ${account.displayName}  (@${account.username}) さんがますとどんちほーにやってきました！🎉`;

    if (accountCreatedDayDiff === 0) {
      text += `\n(アカウント作成から ${withCommas(accountCreatedDayDiff)} 日経過)`;
    }

    const status = await this.createStatus(text);
    this.milestoneLogger.add(1, account, status);
    await this.milestoneLogger.save(milestoneLoggerPath);
  }

  private async celebrateMilestone(account: mastodon.v1.Account, milestone: number): Promise<void> {
    if (this.milestoneLogger.has(milestone, account)) {
      return;
    }

    const accountCreatedDayDiff = dayjs().diff(dayjs(account.createdAt), 'd');
    const text =
      `${account.displayName} (@${account.username}) さんが ${withCommas(milestone)} がおーを達成しました！🎉\n` +
      `(${(milestone / (accountCreatedDayDiff + 1)).toFixed(1)} GPD, ${withCommas(accountCreatedDayDiff)} 日経過)`;

    const status = await this.createStatus(text);
    this.milestoneLogger.add(milestone, account, status);
    await this.milestoneLogger.save(milestoneLoggerPath);
  }

  private async createStatus(status: string): Promise<mastodon.v1.Status> {
    const res = await this.masto.v1.statuses.create({ status, visibility: 'public' });
    console.log(status.replaceAll('\n', ''));

    return res;
  }
}
