import { ComponentPropsWithoutRef } from "react";

export function Alert({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={className} role="alert" {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={className} {...props} />;
}