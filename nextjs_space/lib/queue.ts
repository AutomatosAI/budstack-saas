import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const emailQueueName = "email-sending";

/**
 * US-021 — the delayed triggers that start a scheduled campaign's fan-out.
 *
 * A queue of its own rather than another job name on `email-sending`, for two
 * reasons. One job here becomes thousands of jobs there, so they are not the
 * same unit of work and should not share a concurrency budget. And the email
 * worker expires any job older than EMAIL_MAX_JOB_AGE_MS (PRD-220) so a
 * backlog cannot blast weeks-old mail on restart — correct for a send, fatal
 * for a trigger deliberately dated weeks ahead, which would be dropped as
 * stale the moment it became due.
 */
export const campaignQueueName = "campaign-scheduling";

/**
 * US-028 — the daily reorder-reminder sweep.
 *
 * Its own queue for the same two reasons the campaign triggers have one. One job
 * here becomes one message per eligible customer across every enabled store, so
 * it is not the same unit of work as a send and must not share its concurrency
 * budget. And this queue's jobs are produced by a REPEATABLE scheduler: the
 * email worker expires any job older than EMAIL_MAX_JOB_AGE_MS (PRD-220), which
 * is right for a send and wrong for a sweep that BullMQ may promote late after a
 * restart — the sweep would be dropped as stale and that day's reminders simply
 * would not happen.
 */
export const reorderQueueName = "reorder-reminders";

let emailQueueInstance: Queue | undefined;
let emailQueueEventsInstance: QueueEvents | undefined;
let campaignQueueInstance: Queue | undefined;
let reorderQueueInstance: Queue | undefined;

const getRedisConnection = () => {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
};

export const getEmailQueue = () => {
    if (!emailQueueInstance) {
        const connection = getRedisConnection();
        emailQueueInstance = new Queue(emailQueueName, {
            connection: connection as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
                removeOnComplete: {
                    age: 7 * 24 * 3600, // Keep for 7 days
                    count: 1000,
                },
                removeOnFail: {
                    age: 7 * 24 * 3600, // Keep for 7 days
                },
            },
        });
    }
    return emailQueueInstance;
};

/**
 * The campaign scheduling queue.
 *
 * `attempts: 3` is safe despite each job being a send: the fan-out claims the
 * campaign with a conditional DRAFT|SCHEDULED -> SENDING write, so a retry of a
 * job that already got that far finds the campaign SENDING and refuses. Retries
 * therefore only ever rescue a trigger that failed BEFORE it claimed anything.
 *
 * Completed triggers are kept a week like the email queue's, so "why did this
 * campaign go out at 3am" is answerable after the weekend.
 */
export const getCampaignQueue = () => {
  if (!campaignQueueInstance) {
    const connection = getRedisConnection();
    campaignQueueInstance = new Queue(campaignQueueName, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600,
        },
      },
    });
  }
  return campaignQueueInstance;
};

/**
 * The reorder-reminder queue.
 *
 * `attempts: 1` — no retries, unlike every other queue here. A sweep is not
 * idempotent from the outside: it claims each customer with a conditional write
 * before queueing their message, so a retry of a job that got half way through
 * would correctly skip everyone already claimed, but a retry that reran the
 * WHOLE sweep after a transient Redis error would be indistinguishable from the
 * scheduler firing twice. The claim makes both safe; refusing the retry makes
 * the failure visible instead of quietly absorbed. The next run is tomorrow, and
 * a customer whose window opened today is still in it tomorrow.
 *
 * Completed sweeps are kept a fortnight — long enough to answer "did the
 * reminders go out while I was away" after a two-week absence, and there is at
 * most one of these a day.
 */
export const getReorderQueue = () => {
  if (!reorderQueueInstance) {
    const connection = getRedisConnection();
    reorderQueueInstance = new Queue(reorderQueueName, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: {
          age: 14 * 24 * 3600,
          count: 100,
        },
        removeOnFail: {
          age: 14 * 24 * 3600,
        },
      },
    });
  }
  return reorderQueueInstance;
};

export const getEmailQueueEvents = () => {
  if (!emailQueueEventsInstance) {
    const connection = getRedisConnection();
    emailQueueEventsInstance = new QueueEvents(emailQueueName, {
      connection: connection as any,
    });
  }
  return emailQueueEventsInstance;
};
