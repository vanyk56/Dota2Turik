declare module 'steam-user' {
  import { EventEmitter } from 'node:events';

  export default class SteamUser extends EventEmitter {
    static EPersonaState: {
      Offline: number;
      Online: number;
      Busy: number;
      Away: number;
    };

    constructor(options?: {
      autoRelogin?: boolean;
      renewRefreshTokens?: boolean;
    });

    logOn(details: {
      accountName?: string;
      password?: string;
      refreshToken?: string;
      twoFactorCode?: string;
      authCode?: string;
    }): void;

    logOff(): void;
    setPersona(state: number, name?: string): void;
    gamesPlayed(apps: number[] | number): void;
    sendToGC(
      appid: number,
      msgType: number,
      protoBufHeader: Record<string, unknown> | null,
      payload: Buffer,
      callback?: (appid: number, msgType: number, payload: Buffer) => void,
    ): void;
  }
}
