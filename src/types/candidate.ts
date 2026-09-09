import { Gender } from './enums';

export interface ICandidate {
  id:                   string;
  candidateNumber:      string;
  fullName:             string;
  nickname?:            string;
  gender:               Gender;
  department:           string;
  photoPath?:           string;
  isEligible:           boolean;
  isInTiebreak:         boolean;
  disqualificationNote?: string;
  createdAt:            string;
}
