import { UserRole } from './enums';

export interface ISession {
  role:      UserRole;
  judgeId?:  string;
  startedAt: string;
}
