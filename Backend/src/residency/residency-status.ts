export type ResidencyStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'APPROVED' | 'ACTION_REQUIRED' | 'REJECTED';

export type ResidencySnapshot = {
  status: ResidencyStatus;
  stage: string;
  requiredNextSteps: string[];
  lastSyncedAt?: Date;
  lastError?: string | null;
};

export function residencyCallToAction(snapshot: ResidencySnapshot): string {
  if (snapshot.lastError) {
    return 'We could not sync your E-Residency status. Try again or contact support.';
  }

  if (snapshot.requiredNextSteps.length > 0) {
    return snapshot.requiredNextSteps[0];
  }

  const actions: Record<ResidencyStatus, string> = {
    NOT_STARTED: 'Start your Prospera E-Residency application.',
    IN_PROGRESS: 'Continue your Prospera E-Residency application.',
    UNDER_REVIEW: 'Your application is under review.',
    APPROVED: 'Your E-Residency is approved.',
    ACTION_REQUIRED: 'Review the requested Prospera E-Residency action.',
    REJECTED: 'Contact support to understand your E-Residency decision.',
  };

  return actions[snapshot.status];
}
