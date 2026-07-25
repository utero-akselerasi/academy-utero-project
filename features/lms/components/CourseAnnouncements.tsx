"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Pin, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  is_pinned: boolean;
  published_at: string;
  author: {
    full_name: string;
  };
  is_read?: boolean;
}

interface CourseAnnouncementsProps {
  announcements: Announcement[];
  onMarkAsRead: (announcementId: string) => void;
}

const priorityConfig = {
  low: { icon: Info, color: "text-gray-500", bg: "bg-gray-100" },
  normal: { icon: Megaphone, color: "text-blue-500", bg: "bg-blue-100" },
  high: { icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-100" },
  urgent: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-100" },
};

export function CourseAnnouncements({ announcements, onMarkAsRead }: CourseAnnouncementsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
      // Mark as read when expanded
      if (!announcements.find((a) => a.id === id)?.is_read) {
        onMarkAsRead(id);
      }
    }
    setExpandedIds(newExpanded);
  };

  // Sort: pinned first, then by priority, then by date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    
    const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });

  if (announcements.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No announcements yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sortedAnnouncements.map((announcement) => {
        const isExpanded = expandedIds.has(announcement.id);
        const PriorityIcon = priorityConfig[announcement.priority].icon;
        const shouldTruncate = announcement.content.length > 150;

        return (
          <Card
            key={announcement.id}
            className={`${
              !announcement.is_read ? "border-l-4 border-l-blue-500" : ""
            } ${announcement.is_pinned ? "bg-yellow-50/50" : ""}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {announcement.is_pinned && (
                      <Pin className="h-4 w-4 text-yellow-600" />
                    )}
                    <Badge
                      variant="secondary"
                      className={`${priorityConfig[announcement.priority].bg} ${priorityConfig[announcement.priority].color}`}
                    >
                      <PriorityIcon className="h-3 w-3 mr-1" />
                      {announcement.priority}
                    </Badge>
                    {!announcement.is_read && (
                      <Badge variant="default" className="text-xs">
                        New
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{announcement.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {announcement.author.full_name} •{" "}
                    {formatDistanceToNow(new Date(announcement.published_at), {
                      addSuffix: true,
                      locale: id,
                    })}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <p className="whitespace-pre-wrap text-sm">
                  {isExpanded || !shouldTruncate
                    ? announcement.content
                    : announcement.content.slice(0, 150) + "..."}
                </p>
              </div>
              {shouldTruncate && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => toggleExpand(announcement.id)}
                >
                  {isExpanded ? "Show less" : "Read more"}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
