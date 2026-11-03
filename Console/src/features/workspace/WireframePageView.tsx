import type { ReactNode } from "react";
import { Text, XStack, YStack } from "tamagui";
import { WireframeCount, WireframeDescription, WireframeHeader, WireframeHeading, WireframeIcon, WireframeMain, WireframeTitleGroup } from "./WireframePrimitives";

type WireframePageViewProps = {
  title: string;
  description: string;
  recordCount: number;
  children: ReactNode;
  tableIcon?: ReactNode;
};

export function WireframePageView({ title, description, recordCount, tableIcon, children }: WireframePageViewProps) {
  return (
    <WireframeMain asChild>
      <main className="wireframe-demo-main" aria-labelledby="wireframe-page-title">
        <WireframeHeader asChild>
          <header className="wireframe-page-header">
            <WireframeTitleGroup className="wireframe-page-title-group">
              <WireframeIcon>{tableIcon ?? <Text>✦</Text>}</WireframeIcon>
              <YStack minWidth={0}>
                <WireframeHeading id="wireframe-page-title">{title}</WireframeHeading>
                <WireframeDescription className="wireframe-page-description">{description}</WireframeDescription>
              </YStack>
            </WireframeTitleGroup>
            <XStack className="wireframe-page-count-group" alignItems="center" gap="$wireframeCard">
              <WireframeCount>{recordCount} records</WireframeCount>
            </XStack>
          </header>
        </WireframeHeader>
      {children}
      </main>
    </WireframeMain>
  );
}
