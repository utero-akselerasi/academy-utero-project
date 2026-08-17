import { ComponentPropsWithoutRef } from "react";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: string;
  size?: string;
};

export function Button({ className, type = "button", variant: _variant, size: _size, ...props }: ButtonProps) {
  return <button className={className} type={type} {...props} />;
}