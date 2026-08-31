import { SpecialAwardId } from './enums';

export interface ISpecialAward {
  awardId:          SpecialAwardId;
  label:            string;
  winnerMaleId?:    string;
  winnerFemaleId?:  string;
  isAutoComputed:   boolean;
  notes?:           string;
}
