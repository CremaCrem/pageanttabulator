export interface IJudge {
  id:        string;
  name?:     string;
  photoPath?: string;
  password?: string;
  isActive:  boolean;
  lastSeen?: string;
}
