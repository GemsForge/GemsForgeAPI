import { Paragraph, SizableText, styled } from "tamagui";

/** Shared semantic typography roles for GemsForge surfaces. */
export const GemPageTitle = styled(SizableText, {
  render: "h1",
  margin: 0,
  fontSize: "$6",
  lineHeight: "$6",
  fontWeight: "700",
  letterSpacing: -1,
});

export const GemSectionHeading = styled(SizableText, {
  render: "h2",
  margin: 0,
  fontSize: "$5 desktop:$6",
  lineHeight: "$5 desktop:$6",
  fontWeight: "700",
  letterSpacing: -0.8,
});

export const GemRecordTitle = styled(SizableText, {
  render: "h3",
  margin: 0,
  fontSize: "$4",
  lineHeight: "$4",
  fontWeight: "700",
  letterSpacing: -0.3,
});

export const GemBody = styled(Paragraph, {
  margin: 0,
  fontSize: "$3",
  lineHeight: "$3",
});

export const GemCaption = styled(SizableText, {
  fontSize: "$1",
  lineHeight: "$1",
  fontWeight: "500",
});
