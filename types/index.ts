export interface Badge {
  id: string;
  category: string;
  icon: string;
  name: string;
  description: string;
  rarity: string;
  points: number;
}

export interface UserBadge {
  badge_id: string;
  earned_at: string;
}