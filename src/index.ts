import fs from 'node:fs/promises';
import dayjs from 'dayjs';
import * as dotenv from 'dotenv';
import { createStreamingAPIClient, createRestAPIClient, mastodon } from 'masto';
import consoleStamp from 'console-stamp';

import { MilestoneLogger } from './milestoneLogger.js';

const milestoneLoggerPath = './data/milestone_log.json';

const milestones = [
  100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000,
  5_000_000, 10_000_000, 20_000_000, 50_000_000, 100_000_000,
];
const confing = dotenv.config();
const milestoneLogger = new MilestoneLogger();
consoleStamp(console, { format: ':date(yyyy/mm/dd HH:MM:ss.l).green' });

if (
  await fs
    .access(milestoneLoggerPath, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
) {
  await milestoneLogger.load(milestoneLoggerPath);
}

if (confing.error) {
  throw confing.error;
}

const streaming = createStreamingAPIClient({
  streamingApiUrl: confing.parsed?.MASTODON_STREAMING_API_URL ?? '',
  accessToken: confing.parsed?.MASTODON_ACCESS_TOKEN ?? '',
});
const masto = createRestAPIClient({
  url: confing.parsed?.MASTODON_SERVER ?? '',
  accessToken: confing.parsed?.MASTODON_ACCESS_TOKEN ?? '',
});

(async function main() {
  console.log('celeb_bot started');

  try {
    for await (const event of streaming.public.local.subscribe()) {
      switch (event.event) {
        case 'update': {
          console.log(`${event.payload.account.username}: ${event.payload.account.statusesCount}`);
          await celebrate(event.payload.account);
          break;
        }
        default: {
          break;
        }
      }
    }

    await milestoneLogger.save(milestoneLoggerPath);
  } catch (error) {
    console.error(error);
  }
})();

async function celebrate(account: mastodon.v1.Account): Promise<void> {
  if (account.id === confing.parsed?.MASTODON_SELF_BOT_ID ?? '') {
    return;
  }

  if (account.statusesCount === 1) {
    await celebrateNewFriends(account);
  }

  if (milestones.indexOf(account.statusesCount) !== -1) {
    await celebrateMilestone(account, account.statusesCount);
  }
}

async function celebrateNewFriends(account: mastodon.v1.Account): Promise<void> {
  if (milestoneLogger.has(1, account)) {
    return;
  }

  const accountCreatedDayDiff = dayjs().diff(dayjs(account.createdAt), 'd');
  let text = `新フレンズの ${account.displayName}  (@${account.username}) さんがますとどんちほーにやってきました！🎉`;

  if (accountCreatedDayDiff === 0) {
    text += `\n(アカウント作成から ${withCommas(accountCreatedDayDiff)} 日経過)`;
  }

  const status = await createStatus(text);
  milestoneLogger.add(1, account, status);
  await milestoneLogger.save(milestoneLoggerPath);
}

async function celebrateMilestone(account: mastodon.v1.Account, milestone: number): Promise<void> {
  if (milestoneLogger.has(milestone, account)) {
    return;
  }

  const accountCreatedDayDiff = dayjs().diff(dayjs(account.createdAt), 'd');
  const text =
    `${account.displayName} (@${account.username}) さんが ${withCommas(milestone)} がおーを達成しました！🎉\n` +
    `(${(milestone / (accountCreatedDayDiff + 1)).toFixed(1)} GPD, ${withCommas(accountCreatedDayDiff)} 日経過)`;

  const status = await createStatus(text);
  milestoneLogger.add(milestone, account, status);
  await milestoneLogger.save(milestoneLoggerPath);
}

async function createStatus(status: string): Promise<mastodon.v1.Status> {
  const res = await masto.v1.statuses.create({ status, visibility: 'public' });
  console.log(status.replaceAll('\n', ''));

  return res;
}

// from: https://stackoverflow.com/a/2901298
function withCommas(x?: number): string {
  if (x == null) {
    return '';
  }

  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
