import { ComponentPropsWithoutRef } from "react";

export function Progress({ value = 0, className, ...props }: ComponentPropsWithoutRef<"div"> & { value?: number }) {
  return <div aria-valuemax={100} aria-valuemin={0} aria-valuenow={value} className={className} role="progressbar" {...props} />;
}