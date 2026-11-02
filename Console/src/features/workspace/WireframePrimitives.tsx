import { styled, Text, XStack, YStack } from "tamagui";

export const WireframeMain = styled(YStack, {
  flex: 1,
  minWidth: 0,
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

export const WireframeHeading = styled(Text, {
  render: "h2",
  margin: 0,
  color: "$wireframeHeading",
  fontSize: "$5",
  fontWeight: "700",
  letterSpacing: -0.8,
});

export const WireframeDescription = styled(Text, {
  render: "p",
  marginTop: "$1",
  color: "$wireframeMuted",
  fontSize: "$2",
});

export const WireframeCount = styled(Text, {
  color: "$wireframeMuted",
  fontSize: "$2",
});
