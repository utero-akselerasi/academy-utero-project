"use server";

import { requireAdmin, requireUser } from "@/features/auth/guards";
import {
  localCheckIn,
  localCheckOut,
  localPermit,
  localReview,
  localReviewPermit,
  localSettings,
} from "./local";

export type FormState = {
  ok: boolean;
  message: string;
  isOutOfRange?: boolean;
};

export async function checkInAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  return localCheckIn(formData);
}

export async function checkOutAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  return localCheckOut(formData);
}

export async function reviewAttendanceAction(formData: FormData) {
  await requireAdmin();
  return localReview(formData);
}

export async function submitPermitAction(_: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  return localPermit(formData);
}

export async function saveAttendanceSettingsAction(formData: FormData) {
  await requireAdmin();
  return localSettings(formData);
}

export async function reviewPermitAction(formData: FormData) {
  await requireAdmin();
  return localReviewPermit(formData);
}
