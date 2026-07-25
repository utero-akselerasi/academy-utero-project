"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Clock, TrendingUp, Target, Flame } from "lucide-react";

interface DailyActivity {
  activity_date: string;
  lessons_completed: number;
  quizzes_taken: number;
  assignments_submitted: number;
  total_time_seconds: number;
  points_earned: number;
}

interface AnalyticsSummary {
  totalLessonsCompleted: number;
  totalQuizzesTaken: number;
  totalAssignmentsSubmitted: number;
  totalTimeHours: number;
  totalPoints: number;
  averageScoreQuiz: number;
  averageScoreAssignment: number;
  currentStreak: number;
  longestStreak: number;
}

interface LearningAnalyticsProps {
  dailyActivities: DailyActivity[];
  summary: AnalyticsSummary;
}

export function LearningAnalytics({ dailyActivities, summary }: LearningAnalyticsProps) {
  // Transform data for charts
  const chartData = dailyActivities.map((day) => ({
    date: new Date(day.activity_date).toLocaleDateString("id-ID", { 
      day: "numeric", 
      month: "short" 
    }),
    lessons: day.lessons_completed,
    quizzes: day.quizzes_taken,
    assignments: day.assignments_submitted,
    hours: Math.round((day.total_time_seconds / 3600) * 10) / 10,
    points: day.points_earned,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Lessons</span>
                <span className="text-lg font-bold">{summary.totalLessonsCompleted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Quizzes</span>
                <span className="text-lg font-bold">{summary.totalQuizzesTaken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Assignments</span>
                <span className="text-lg font-bold">{summary.totalAssignmentsSubmitted}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              Time Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.totalTimeHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground mt-1">hours learning</p>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Avg per day: </span>
              <span className="font-semibold">
                {dailyActivities.length > 0
                  ? (summary.totalTimeHours / dailyActivities.length).toFixed(1)
                  : 0}h
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
              Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Quiz Avg</span>
                  <span className="font-semibold">{summary.averageScoreQuiz}%</span>
                </div>
                <Progress value={summary.averageScoreQuiz} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Assignment Avg</span>
                  <span className="font-semibold">{summary.averageScoreAssignment}%</span>
                </div>
                <Progress value={summary.averageScoreAssignment} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold flex items-center gap-1">
              {summary.currentStreak}
              <span className="text-orange-500">🔥</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">days in a row</p>
            <div className="mt-2 text-sm">
              <span className="text-muted-foreground">Best: </span>
              <span className="font-semibold">{summary.longestStreak} days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" style={{ fontSize: "12px" }} />
              <YAxis style={{ fontSize: "12px" }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="lessons"
                stroke="#3b82f6"
                name="Lessons"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="quizzes"
                stroke="#8b5cf6"
                name="Quizzes"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="assignments"
                stroke="#10b981"
                name="Assignments"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Time & Points Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Learning Time (Hours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: "12px" }} />
                <YAxis style={{ fontSize: "12px" }} />
                <Tooltip />
                <Bar dataKey="hours" fill="#10b981" name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Points Earned</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" style={{ fontSize: "12px" }} />
                <YAxis style={{ fontSize: "12px" }} />
                <Tooltip />
                <Bar dataKey="points" fill="#f59e0b" name="Points" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
