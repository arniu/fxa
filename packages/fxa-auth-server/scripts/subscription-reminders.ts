/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import program from 'commander';

import initShared from '../lib/payments/processing-tasks-shared';
import { SubscriptionReminders } from '../lib/payments/subscription-reminders';

const pckg = require('../package.json');
const config = require('../config').getProperties();

async function init() {
  program
    .version(pckg.version)
    .option(
      '-p, --plan-length [days]',
      'Plan length in days beyond which a reminder email before the next recurring charge should be sent. Defaults to 180.',
      '180'
    )
    .option(
      '-r, --reminder-length [days]',
      'Reminder length in days before the renewal date to send the reminder email. Defaults to 14.',
      '14'
    )
    .parse(process.argv);

  const isPaypalProcessor = false;
  const { log, database, senders } = await initShared(isPaypalProcessor);

  const subscriptionReminders = new SubscriptionReminders(
    log,
    config,
    parseInt(program.planLength),
    parseInt(program.reminderLength),
    database,
    senders.email
  );
  await subscriptionReminders.sendReminders();
  return 0;
}

if (require.main === module) {
  init()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .then((result) => process.exit(result));
}
