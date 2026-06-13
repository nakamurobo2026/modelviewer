export type Priority = "S" | "A" | "B" | "C";

export type Source = {
  id?: string;
  sourceType: string;
  priority: Priority;
  weight: number;
  url?: string;
  title?: string;
  summary?: string;
  reliability: number;
  impact: number;
  extractedElements?: string[];
};

export type ViralElement = {
  elementType: "hook" | "empathy" | "discomfort" | "comment_trigger" | "phrase" | "angle";
  value: string;
  score: number;
};

export type ResearchResponse = {
  success: true;
  briefId: string;
  summary: string;
  sources: Source[];
  viralElements: ViralElement[];
};

export type DraftStatus =
  | "draft"
  | "scored"
  | "approved"
  | "rejected"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type Draft = {
  id: string;
  text: string;
  status?: DraftStatus;
  category: string;
  hookType?: string;
  scoreTotal: number;
  scoreDetail: {
    specificity?: number;
    commentPotential?: number;
    humanity?: number;
    novelty?: number;
    brandFit?: number;
    risk?: number;
  };
  sourceTrace: string[];
  scheduledAt?: string;
  failureReason?: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
