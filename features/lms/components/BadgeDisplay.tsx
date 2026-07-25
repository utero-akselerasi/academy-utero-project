"use client";

import { Badge, UserBadge } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Award, Zap } from "lucide-react";

interface BadgeDisplayProps {
  badges: UserBadge[];
  allBadges: Badge[];
  userPoints?: {
    total_points: number;
    level: number;
    level_progress: number;
  };
}

const rarityColors = {
  common: "bg-gray-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-orange-500",
};

const rarityBorders = {
  common: "border-gray-300",
  rare: "border-blue-300",
  epic: "border-purple-300",
  legendary: "border-orange-300",
};

export function BadgeDisplay({ badges, allBadges, userPoints }: BadgeDisplayProps) {
  const earnedBadgeIds = new Set(badges.map((ub) => ub.badge_id));
  const earnedBadges = allBadges.filter((b) => earnedBadgeIds.has(b.id));
  const lockedBadges = allBadges.filter((b) => !earnedBadgeIds.has(b.id));

  const badgesByCategory = (badgeList: Badge[]) => {
    return badgeList.reduce((acc, badge) => {
      if (!acc[badge.category]) acc[badge.category] = [];
      acc[badge.category].push(badge);
      return acc;
    }, {} as Record<string, Badge[]>);
  };

  const earnedByCategory = badgesByCategory(earnedBadges);
  const lockedByCategory = badgesByCategory(lockedBadges);

  return (
    <div className="space-y-6">
      {/* User Level & Points */}
      {userPoints && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Level {userPoints.level}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress to Level {userPoints.level + 1}</span>
                <span className="font-semibold">{userPoints.level_progress}%</span>
              </div>
              <Progress value={userPoints.level_progress} className="h-3" />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                <span className="text-lg font-bold">{userPoints.total_points.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">Points</span>
              </div>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-500" />
                <span className="text-lg font-bold">{badges.length}</span>
                <span className="text-sm text-muted-foreground">Badges</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Your Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="earned" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="earned">Earned ({badges.length})</TabsTrigger>
              <TabsTrigger value="locked">Locked ({lockedBadges.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="earned" className="space-y-6 mt-4">
              {Object.keys(earnedByCategory).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No badges earned yet. Start learning to unlock your first badge!
                </p>
              ) : (
                Object.entries(earnedByCategory).map(([category, categoryBadges]) => (
                  <div key={category}>
                    <h3 className="font-semibold capitalize mb-3">{category}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoryBadges.map((badge) => {
                        const userBadge = badges.find((ub) => ub.badge_id === badge.id);
                        return (
                          <div
                            key={badge.id}
                            className={`p-4 border-2 rounded-lg ${rarityBorders[badge.rarity as keyof typeof rarityBorders]} bg-card hover:shadow-md transition-shadow`}
                          >
                            <div className="text-center space-y-2">
                              <div className="text-4xl">{badge.icon}</div>
                              <div className="font-semibold text-sm">{badge.name}</div>
                              <div className="text-xs text-muted-foreground">{badge.description}</div>
                              <div className="flex items-center justify-center gap-2 text-xs">
                                <span className={`px-2 py-1 rounded-full text-white ${rarityColors[badge.rarity as keyof typeof rarityColors]}`}>
                                  {badge.rarity}
                                </span>
                                <span className="font-semibold">+{badge.points} pts</span>
                              </div>
                              {userBadge && (
                                <div className="text-xs text-muted-foreground">
                                  Earned {new Date(userBadge.earned_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="locked" className="space-y-6 mt-4">
              {Object.keys(lockedByCategory).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You've unlocked all badges! Amazing work! 🎉
                </p>
              ) : (
                Object.entries(lockedByCategory).map(([category, categoryBadges]) => (
                  <div key={category}>
                    <h3 className="font-semibold capitalize mb-3">{category}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {categoryBadges.map((badge) => (
                        <div
                          key={badge.id}
                          className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-muted/30 opacity-60"
                        >
                          <div className="text-center space-y-2">
                            <div className="text-4xl grayscale">{badge.icon}</div>
                            <div className="font-semibold text-sm">{badge.name}</div>
                            <div className="text-xs text-muted-foreground">{badge.description}</div>
                            <div className="flex items-center justify-center gap-2 text-xs">
                              <span className={`px-2 py-1 rounded-full text-white ${rarityColors[badge.rarity as keyof typeof rarityColors]}`}>
                                {badge.rarity}
                              </span>
                              <span className="font-semibold">+{badge.points} pts</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
