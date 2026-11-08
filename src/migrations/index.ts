import * as migration_20260813_220723_init_schema from './20260813_220723_init_schema';
import * as migration_20261029_160000_add_winner_notification_enabled from './20261029_160000_add_winner_notification_enabled';
import * as migration_20261031_210000_create_drink_rewards_schema from './20261031_210000_create_drink_rewards_schema';
import * as migration_20261108_120000_add_reclaim_controls from './20261108_120000_add_reclaim_controls';

export const migrations = [
  {
    up: migration_20260813_220723_init_schema.up,
    down: migration_20260813_220723_init_schema.down,
    name: '20260813_220723_init_schema',
  },
  {
    up: migration_20261029_160000_add_winner_notification_enabled.up,
    down: migration_20261029_160000_add_winner_notification_enabled.down,
    name: '20261029_160000_add_winner_notification_enabled',
  },
  {
    up: migration_20261031_210000_create_drink_rewards_schema.up,
    down: migration_20261031_210000_create_drink_rewards_schema.down,
    name: '20261031_210000_create_drink_rewards_schema',
  },
  {
    up: migration_20261108_120000_add_reclaim_controls.up,
    down: migration_20261108_120000_add_reclaim_controls.down,
    name: '20261108_120000_add_reclaim_controls',
  },
];

