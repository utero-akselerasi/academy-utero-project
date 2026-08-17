import { ComponentPropsWithoutRef } from "react";

type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  variant?: string;
};

export function Badge({ className, variant: _variant, ...props }: BadgeProps) {
  return <span className={className} {...props} />;
}