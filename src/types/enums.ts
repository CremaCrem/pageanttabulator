export enum Gender {
  Male   = 'male',
  Female = 'female',
}

export enum UserRole {
  Admin  = 'admin',
  Judge  = 'judge',
  Viewer = 'viewer',
}

export enum SegmentId {
  ProductionNumber   = 'production_number',
  SchoolUniform      = 'school_uniform',
  ProfessionalAttire = 'professional_attire',
  ModernBarong       = 'modern_barong',
  PreliminaryQA      = 'preliminary_qa',
  FinalQA            = 'final_qa',
  BestAdvocacy       = 'best_advocacy',
  BestInRamp         = 'best_in_ramp',
  TieBreakingQA      = 'tie_breaking_qa',
}

export enum RoundStatus {
  NotStarted = 'not_started',
  Open       = 'open',
  Locked     = 'locked',
}

export enum SegmentCategory {
  Preliminary = 'preliminary',
  Final       = 'final',
  MinorAward  = 'minor_award',
  Tiebreak    = 'tiebreak',
}

export enum SpecialAwardId {
  BestProductionNumber  = 'best_production_number',
  BestSchoolUniform     = 'best_school_uniform',
  BestProfessional      = 'best_professional',
  BestBarongFilipiniana = 'best_barong_filipiniana',
  BestAdvocacy          = 'best_advocacy',
  SpiritAward           = 'spirit_award',
  Photogenic            = 'photogenic',
  PeoplesChoice         = 'peoples_choice',
  Congeniality          = 'congeniality',
  BestInRamp            = 'best_in_ramp',
}
