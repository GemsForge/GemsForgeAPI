import { styled, XStack, YStack } from "tamagui";
import { GemBody, GemCaption, GemSectionHeading } from "@gemsforge/ui";

export const WireframeMain = styled(YStack, {
  flex: 1,
  minWidth: 0,
  width: "100%",
  gridColumn: 2,
  gridRow: 2,
  padding: "$wireframeContent",
  backgroundColor: "$wireframeCanvas",
  color: "$wireframeInk",
});

export const WireframeHeader = styled(XStack, {
  alignItems: "center",
  justifyContent: "space-between",
  gap: "$wireframeCard",
  marginBottom: "$wireframeContent",
});

export const WireframeTitleGroup = styled(XStack, {
  alignItems: "center",
  gap: "$wireframeCard",
  minWidth: 0,
});

export const WireframeIcon = styled(YStack, {
  width: 32,
  height: 32,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "$wireframeControl",
  backgroundColor: "$wireframeHeading",
  color: "$wireframePanelLight",
});

export const WireframeHeading = styled(GemSectionHeading, {
  color: "$wireframeHeading",
  fontSize: "$5",
  lineHeight: "$5",
});

export const WireframeDescription = styled(GemBody, {
  color: "$wireframeMuted",
  fontSize: "$2",
  lineHeight: "$2",
});

export const WireframeCount = styled(GemCaption, {
  color: "$wireframeMuted",
  fontSize: "$2",
  lineHeight: "$2",
});
