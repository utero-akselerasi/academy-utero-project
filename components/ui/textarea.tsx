import { ComponentPropsWithoutRef } from "react";

export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={className} {...props} />;
}