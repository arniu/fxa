import { Page } from 'playwright';
import { BaseEnv } from '../env/base';
import { ChangePasswordPage } from './changePassword';
import { DisplayNamePage } from './displayName';
import { LoginPage } from './login';
import { RecoveryKeyPage } from './recoveryKey';
import { RelierPage } from './relier';
import { SettingsPage } from './settings';
import { TotpPage } from './totp';

export function create(page: Page, env: BaseEnv) {
  return {
    page,
    changePassword: new ChangePasswordPage(page, env),
    displayName: new DisplayNamePage(page, env),
    login: new LoginPage(page, env),
    settings: new SettingsPage(page, env),
    recoveryKey: new RecoveryKeyPage(page, env),
    relier: new RelierPage(page, env),
    totp: new TotpPage(page, env),
  };
}
