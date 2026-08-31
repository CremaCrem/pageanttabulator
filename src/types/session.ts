import { UserRole } from './enums';

export interface ISession {
  role:          UserRole;
  judgeId?:      string;
  sessionToken?: string;
  startedAt:     string;
}

