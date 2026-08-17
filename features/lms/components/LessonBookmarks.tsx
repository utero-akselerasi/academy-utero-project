"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
function formatRelativeTime(date: Date) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  const units = [
    { label: "tahun", seconds: 31536000 },
    { label: "bulan", seconds: 2592000 },
    { label: "hari", seconds: 86400 },
    { label: "jam", seconds: 3600 },
    { label: "menit", seconds: 60 },
  ];
  const unit = units.find((item) => diffSeconds >= item.seconds);
  if (!unit) return "baru saja";
  return `${Math.floor(diffSeconds / unit.seconds)} ${unit.label} lalu`;
}
interface LessonBookmark {
  id: string;
  lesson_id: string;
  note?: string;
  created_at: string;
  lesson: {
    title: string;
    course_id: string;
  };
}

interface BookmarkButtonProps {
  lessonId: string;
  isBookmarked: boolean;
  onToggle: (lessonId: string, note?: string) => void;
}

export function BookmarkButton({ lessonId, isBookmarked, onToggle }: BookmarkButtonProps) {
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [note, setNote] = useState("");

  const handleToggle = () => {
    if (isBookmarked) {
      onToggle(lessonId);
      setShowNoteInput(false);
      setNote("");
    } else {
      setShowNoteInput(true);
    }
  };

  const handleSave = () => {
    onToggle(lessonId, note);
    setShowNoteInput(false);
    setNote("");
  };

  return (
    <div className="space-y-2">
      <Button
        variant={isBookmarked ? "default" : "outline"}
        size="sm"
        onClick={handleToggle}
        className="gap-2"
      >
        {isBookmarked ? (
          <>
            <BookmarkCheck className="h-4 w-4" />
            Bookmarked
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" />
            Bookmark
          </>
        )}
      </Button>

      {showNoteInput && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <Textarea
              placeholder="Add a note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                Save Bookmark
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowNoteInput(false);
                  setNote("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface BookmarksListProps {
  bookmarks: LessonBookmark[];
  onDelete: (bookmarkId: string) => void;
  onNavigate: (courseId: string, lessonId: string) => void;
}

export function BookmarksList({ bookmarks, onDelete, onNavigate }: BookmarksListProps) {
  if (bookmarks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No bookmarks yet</p>
          <p className="text-sm mt-1">Bookmark important lessons for quick access</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bookmarks.map((bookmark) => (
        <Card key={bookmark.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <button
                  onClick={() => onNavigate(bookmark.lesson.course_id, bookmark.lesson_id)}
                  className="text-left"
                >
                  <h4 className="font-semibold hover:text-blue-600 transition-colors">
                    {bookmark.lesson.title}
                  </h4>
                </button>
                {bookmark.note && (
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                    {bookmark.note}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Bookmarked{" "}
                  {formatRelativeTime(new Date(bookmark.created_at))}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(bookmark.id)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
