/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import { Logger } from 'mozlog';
import Stripe from 'stripe';
import { Container } from 'typedi';

import { ConfigType } from '../../config';
import { reportSentryError } from '../sentry';
import { SentEmailParams, Plan } from 'fxa-shared/subscriptions/types';
import { StripeHelper, TimeSpanInS } from './stripe';
import { SentEmail } from 'fxa-shared/db/models/auth';

export class SubscriptionReminders {
  private db: any;
  private mailer: any;
  private stripeHelper: StripeHelper;
  private DAYS_IN_A_WEEK: number = 7;
  private DAYS_IN_A_MONTH: number = 30;
  private DAYS_IN_A_YEAR: number = 365;
  private MS_IN_A_DAY: number = 24 * 60 * 60 * 1000;
  private REMINDER_LENGTH_MS: number;
  private EMAIL_TYPE: string = 'subscriptionRenewalReminder';
  private eligiblePlansByInterval: {
    day: Function;
    week: Function;
    month: Function;
    year: Function;
  };

  constructor(
    private log: Logger,
    config: ConfigType,
    private planLength: number,
    private reminderLength: number,
    db: any,
    mailer: any
  ) {
    this.db = db;
    this.mailer = mailer;
    this.stripeHelper = Container.get(StripeHelper);
    this.REMINDER_LENGTH_MS = this.reminderLength * this.MS_IN_A_DAY;

    this.eligiblePlansByInterval = {
      day: (plan: Plan) => plan.interval_count >= this.planLength,
      week: (plan: Plan) =>
        plan.interval_count >= this.planLength / this.DAYS_IN_A_WEEK,
      month: (plan: Plan) =>
        plan.interval_count >= this.planLength / this.DAYS_IN_A_MONTH,
      year: (plan: Plan) =>
        plan.interval_count >= this.planLength / this.DAYS_IN_A_YEAR,
    };
  }

  /**
   * For all possible plan.intervals, determine if the plan is sufficiently
   * long based on planLength.
   */
  private isEligiblePlan(plan: Plan): boolean {
    for (let checkFn of Object.values(this.eligiblePlansByInterval)) {
      if (checkFn(plan)) {
        return true;
      }
    }
    return false;
  }

  private async getEligiblePlans(): Promise<Plan[]> {
    const allPlans = await this.stripeHelper.allPlans();
    return allPlans.filter((plan) => this.isEligiblePlan(plan));
  }

  /**
   * Returns a window of time in seconds [startTimeS, endTimeS)
   * that is exactly one day (today) in UTC.
   */
  private getStartAndEndTimes(): TimeSpanInS {
    const reminderDay = new Date(Date.now() + this.REMINDER_LENGTH_MS);
    // Get hour 0, minute 0, second 0 for today's date
    const startingTimestamp = new Date(
      Date.UTC(
        reminderDay.getUTCFullYear(),
        reminderDay.getUTCMonth(),
        reminderDay.getUTCDate(),
        0,
        0,
        0
      )
    );
    // Get hour 0, minute, 0, second 0 for one day from today's date
    const endingTimestamp = new Date(
      startingTimestamp.getTime() + this.MS_IN_A_DAY
    );

    const startTimeS = Math.floor(startingTimestamp.getTime() / 1000);
    const endTimeS = Math.floor(endingTimestamp.getTime() / 1000);
    return {
      startTimeS,
      endTimeS,
    };
  }

  private async alreadySentEmail(
    uid: string,
    currentPeriodStartMs: number,
    emailParams: SentEmailParams
  ) {
    const emailRecord = await SentEmail.findLatestSentEmailByType(
      uid,
      this.EMAIL_TYPE,
      emailParams
    );
    // This could be the first email for a given subscription or a subsequent one.
    if (emailRecord && emailRecord.sentAt > currentPeriodStartMs) {
      return true;
    }
    return false;
  }

  private async updateSentEmail(uid: string, emailParams: SentEmailParams) {
    await SentEmail.createSentEmail(uid, this.EMAIL_TYPE, emailParams);
  }

  /**
   * Send out a renewal reminder email if we haven't already sent one.
   */
  async sendSubscriptionRenewalReminderEmail(
    subscription: Stripe.Subscription
  ) {
    const {
      uid,
      email,
    } = await this.stripeHelper.getCustomerUidEmailFromSubscription(
      subscription
    );
    if (!uid || !email) {
      // Deleted customer
      return;
    }
    const emailParams = { subscriptionId: subscription.id };
    if (
      await this.alreadySentEmail(
        uid,
        Math.floor(subscription.current_period_start * 1000),
        emailParams
      )
    ) {
      return;
    }
    try {
      const account = await this.db.account(uid);
      this.log.info('sendSubscriptionRenewalReminderEmail', {
        message: 'Sending a renewal reminder email.',
        subscriptionId: subscription.id,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        currentDateS: Math.floor(Date.now() / 1000),
      });
      await this.mailer.sendSubscriptionRenewalReminderEmail(
        account.emails,
        account,
        {
          acceptLanguage: account.locale,
        }
      );
      await this.updateSentEmail(uid, emailParams);
    } catch (err) {
      this.log.error('sendSubscriptionRenewalReminderEmail', {
        err,
        subscriptionId: subscription.id,
      });
      reportSentryError(err);
    }
  }

  /**
   * Sends a reminder email for all active subscriptions for all plans
   * as long or longer than `planLength`:
   *   1. Get a list of all plans of sufficient `planLength`
   *   2. For each plan get active subscriptions with `current_period_end`
   *      dates `reminderLength` away from now.
   *   3. Send a reminder email if one hasn't already been sent.
   */
  public async sendReminders() {
    // 1
    const plans = await this.getEligiblePlans();

    // 2
    const timePeriod = this.getStartAndEndTimes();
    for (let { plan_id } of plans) {
      let hasMoreSubscriptions = true;
      let startingAfter;
      while (hasMoreSubscriptions) {
        const {
          subscriptions,
          hasMore,
        }: {
          subscriptions: Stripe.Subscription[];
          hasMore: boolean;
        } = await this.stripeHelper.findActiveSubscriptionsByPlanId(
          plan_id,
          timePeriod,
          startingAfter
        );

        // 3
        for (let subscription of subscriptions) {
          try {
            await this.sendSubscriptionRenewalReminderEmail(subscription);
          } catch (err) {
            this.log.error('sendSubscriptionRenewalReminderEmail', {
              err,
              subscriptionId: subscription.id,
            });
            reportSentryError(err);
            return false;
          }
        }

        hasMoreSubscriptions = hasMore;
        startingAfter = subscriptions.length
          ? subscriptions[subscriptions.length - 1].id
          : undefined;
      }
    }
    return true;
  }
}
