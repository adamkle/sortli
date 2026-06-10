import { Timestamp } from 'firebase/firestore';

export type UserTier = 'guest' | 'registered' | 'lite' | 'gold';
export type SubscriptionStatus = 'active' | 'expired' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  tier: UserTier;
  institutionCodes: string[];
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Institution {
  code: string;
  name: string;
  expiresAt: Timestamp | Date;
  maxUsers: number;
  currentUserCount: number;
  subscriptionStatus: SubscriptionStatus;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Participant {
  id: string;
  firstName: string;
  lastName?: string;
  nickname?: string;
  gender?: 'boy' | 'girl';
  phone?: string;
  notes?: string;
}

export interface QueueState {
  matrixSequence: string[]; // The flat 1D array of participant IDs generated in step 1
  participantsCount: number; // N (the count of participants at generation time)
  currentGlobalIndex: number; // Pointer to the current active turn in the flat array (starts at 0)
  currentRound: number; // The sub-round counter (starts at 1)
  updatedAt: Timestamp | Date;
}

export interface SecretDrawState {
  shuffledSequence: string[]; // Flat 1D array of participant IDs
  updatedAt: Timestamp | Date;
}

export interface RandomChooserState {
  chosenIds: string[]; // Array of participant IDs who have already been selected in the current round
  lastChosenId: string | null; // The single ID of the participant drawn in the most recent click
  updatedAt: Timestamp | Date;
}

export interface GroupsState {
  shuffledSequence: string[]; // Flat 1D array of randomly shuffled participant IDs
  allocationType: 'numberOfGroups' | 'countPerGroup'; // Mode selected by user
  targetValue: number; // The target integer input (e.g., 3 groups or 3 kids per group)
  updatedAt: Timestamp | Date;
}

export interface SharedList {
  id: string;
  name: string;
  creatorId: string;
  allowedUsers: string[];
  institutionCode?: string;
  participants: Participant[];
  queueState: QueueState;
  secretDrawState?: SecretDrawState;
  randomChooserState?: RandomChooserState;
  groupsState?: GroupsState;
  giftExchangeState?: GiftExchangeState;
  randomOrderState?: RandomOrderState;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  expiresAt?: Timestamp | Date;
  isPremiumAccount?: boolean;
}

export interface GiftExchangeState {
  shuffledSequence: string[]; // Flat 1D array of participant IDs for gift exchange
  updatedAt: Timestamp | Date;
}

export interface RandomOrderState {
  shuffledSequence: string[]; // Flat 1D array of randomly shuffled participant IDs
  updatedAt: Timestamp | Date;
}

