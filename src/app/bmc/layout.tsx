import type { Metadata } from "next";
import { DM_Mono, Fraunces, Outfit } from "next/font/google";
import { PROGRAM_NAME } from "@/lib/bmc/config";
import "./bmc.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: PROGRAM_NAME,
  description: `${PROGRAM_NAME} — program platform for the build team and enrolled participants.`,
};

export default function BmcLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`bmc flex-1 flex flex-col ${fraunces.variable} ${outfit.variable} ${dmMono.variable}`}
    >
      {children}
    </div>
  );
}
