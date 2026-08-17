import { ComponentPropsWithoutRef } from "react";

export function Tabs({ className, ...props }: ComponentPropsWithoutRef<"div"> & { defaultValue?: string }) {
  return <div className={className} {...props} />;
}

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={className} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<"button"> & { value: string }) {
  return <button className={className} type="button" {...props} />;
}

export function TabsContent({ className, ...props }: ComponentPropsWithoutRef<"div"> & { value: string }) {
  return <div className={className} {...props} />;
}