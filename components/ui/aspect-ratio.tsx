"use client";

import * as React from "react";
import { AspectRatio as AspectRatioPrimitive } from "@radix-ui/react-aspect-ratio";

function AspectRatio({
  ...props
}: React.ComponentPropsWithoutRef<typeof AspectRatioPrimitive>) {
  return <AspectRatioPrimitive data-slot="aspect-ratio" {...props} />;
}

export { AspectRatio };
