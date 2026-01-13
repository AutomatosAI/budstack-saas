import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

export const emailQueueName = "email-sending";

let emailQueueInstance: Queue | undefined;
let emailQueueEventsInstance: QueueEvents | undefined;

const getRedisConnection = () => {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });
};

export const getEmailQueue = () => {
  console.log("DEBUG: getEmailQueue called");
  console.trace("DEBUG: Trace for getEmailQueue");
  if (!emailQueueInstance) {
    const connection = getRedisConnection();
    emailQueueInstance = new Queue(emailQueueName, {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
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

export const getEmailQueueEvents = () => {
  if (!emailQueueEventsInstance) {
    const connection = getRedisConnection();
    emailQueueEventsInstance = new QueueEvents(emailQueueName, {
      connection: connection as any,
    });
  }
  return emailQueueEventsInstance;
};
