import type { ReactNode } from "react";
import { Text, XStack, YStack } from "tamagui";
import { WireframeCount, WireframeDescription, WireframeHeader, WireframeHeading, WireframeIcon, WireframeMain, WireframeTitleGroup } from "./WireframePrimitives";

type WireframePageViewProps = {
  title: string;
  description: string;
  recordCount: number;
  children: ReactNode;
};

export function WireframePageView({ title, description, recordCount, children }: WireframePageViewProps) {
  return (
    <WireframeMain asChild>
      <main className="wireframe-demo-main" aria-labelledby="wireframe-page-title">
        <WireframeHeader asChild>
          <header>
            <WireframeTitleGroup>
              <WireframeIcon><Text>✦</Text></WireframeIcon>
              <YStack minWidth={0}>
                <WireframeHeading id="wireframe-page-title">{title}</WireframeHeading>
                <WireframeDescription>{description}</WireframeDescription>
              </YStack>
            </WireframeTitleGroup>
            <XStack alignItems="center" gap="$wireframeCard">
              <WireframeCount>{recordCount} records</WireframeCount>
            </XStack>
          </header>
        </WireframeHeader>
      {children}
      </main>
    </WireframeMain>
  );
}
