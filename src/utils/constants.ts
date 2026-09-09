import { SegmentId, RoundStatus, ISegment, SegmentCategory } from '../types';

export const SEGMENTS: Record<SegmentId, ISegment> = {
  [SegmentId.ProductionNumber]: {
    id: SegmentId.ProductionNumber,
    category: SegmentCategory.Preliminary,
    label: "Production Number",
    roundStatus: RoundStatus.NotStarted,
    preliminaryWeight: 0.20,
    criteria: [
      { id: "stage_presence", label: "Stage Presence", weight: 0.40 },
      { id: "energy", label: "Energy", weight: 0.30 },
      { id: "audience_engagement", label: "Audience Engagement", weight: 0.20 },
      { id: "overall_appeal", label: "Overall Appeal", weight: 0.10 },
    ]
  },
  [SegmentId.SchoolUniform]: {
    id: SegmentId.SchoolUniform,
    category: SegmentCategory.Preliminary,
    label: "School Uniform",
    roundStatus: RoundStatus.NotStarted,
    preliminaryWeight: 0.20,
    criteria: [
      { id: "neatness", label: "Neatness", weight: 0.25 },
      { id: "confidence_bearing", label: "Confidence & Bearing", weight: 0.25 },
      { id: "advocacy", label: "Advocacy", weight: 0.25 },
      { id: "overall_impact", label: "Overall Impact", weight: 0.25 },
    ]
  },
  [SegmentId.ProfessionalAttire]: {
    id: SegmentId.ProfessionalAttire,
    category: SegmentCategory.Preliminary,
    label: "Professional Attire",
    roundStatus: RoundStatus.NotStarted,
    preliminaryWeight: 0.20,
    criteria: [
      { id: "elegance_professionalism", label: "Elegance & Professionalism", weight: 0.35 },
      { id: "suitability", label: "Suitability", weight: 0.25 },
      { id: "confidence_stage", label: "Confidence on Stage", weight: 0.20 },
      { id: "overall_impact", label: "Overall Impact", weight: 0.20 },
    ]
  },
  [SegmentId.ModernBarong]: {
    id: SegmentId.ModernBarong,
    category: SegmentCategory.Preliminary,
    label: "Modern Barong / Filipiniana",
    roundStatus: RoundStatus.NotStarted,
    preliminaryWeight: 0.20,
    criteria: [
      { id: "elegance_poise", label: "Elegance & Poise", weight: 0.35 },
      { id: "suitability_creativity", label: "Suitability & Creativity", weight: 0.25 },
      { id: "confidence_stage", label: "Confidence on Stage", weight: 0.20 },
      { id: "overall_impact", label: "Overall Impact", weight: 0.20 },
    ]
  },
  [SegmentId.PreliminaryQA]: {
    id: SegmentId.PreliminaryQA,
    category: SegmentCategory.Preliminary,
    label: "Preliminary Q&A",
    roundStatus: RoundStatus.NotStarted,
    preliminaryWeight: 0.20,
    criteria: [
      { id: "content_substance", label: "Content & Substance", weight: 0.40 },
      { id: "clarity_organization", label: "Clarity & Organization", weight: 0.25 },
      { id: "confidence_delivery", label: "Confidence & Delivery", weight: 0.20 },
      { id: "relevance", label: "Relevance", weight: 0.15 },
    ]
  },
  [SegmentId.FinalQA]: {
    id: SegmentId.FinalQA,
    category: SegmentCategory.Final,
    label: "Final Q&A",
    roundStatus: RoundStatus.NotStarted,
    preliminaryWeight: 0.50,
    criteria: [
      { id: "content_substance", label: "Content & Substance", weight: 0.40 },
      { id: "clarity_organization", label: "Clarity & Organization", weight: 0.25 },
      { id: "confidence_delivery", label: "Confidence & Delivery", weight: 0.20 },
      { id: "relevance", label: "Relevance", weight: 0.15 },
    ]
  }
};
