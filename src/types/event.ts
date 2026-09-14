export interface IEventConfig {
  id:          number;
  name:        string;
  subtitle:    string;
  eventDate:   string;
  venue:       string;
  judgeCount:  number;
  headTabulator?: string;
  coordinator?:   string;
  auditor?:       string;
  createdAt:   string;
}
