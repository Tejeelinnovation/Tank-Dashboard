"use client";

import dynamic from "next/dynamic";

const FluidTank = dynamic(() => import("./FluidTank"), {
  ssr: false,
});

export default FluidTank;
