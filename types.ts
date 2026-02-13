
export type Resolution = '1K' | '2K' | '4K';

export interface PhotoCleanImage {
  url: string;
  id: string;
  name: string;
  originalUrl?: string;
  createdAt: number;
  resolution?: Resolution;
  prompt?: string;
}

export interface CreditState {
  remaining: number;
  total: number;
  hasClaimedInitial: boolean;
}

export enum AppView {
  LANDING = 'LANDING',
  AUTH = 'AUTH',
  ONBOARDING = 'ONBOARDING',
  CLAIM_CREDITS = 'CLAIM_CREDITS',
  DASHBOARD = 'DASHBOARD',
  EDITOR = 'EDITOR',
  GALLERY = 'GALLERY',
  SUBSCRIPTION = 'SUBSCRIPTION'
}

export interface User {
  email: string;
  name: string;
  isNew: boolean;
  preferences?: {
    useCase: string;
    expertise: string;
  };
}
