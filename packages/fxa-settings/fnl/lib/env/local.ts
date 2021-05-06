import { EnvName } from '.';
import { BaseEnv, Credentials } from './base';

export class LocalEnv extends BaseEnv {
  static readonly env = 'local';
  readonly name: EnvName = LocalEnv.env;
  readonly contentServerUrl = 'http://localhost:3030';
  readonly relierUrl = 'http://localhost:8080';

  constructor() {
    super('http://localhost:9000', 'http://localhost:9001');
  }

  async createAccount(email: string, password: string) {
    const result = await this.auth.signUp(email, password, {
      lang: 'en',
      preVerified: 'true',
    });
    return {
      email,
      password,
      ...result,
    };
  }
}
