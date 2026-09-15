import { describe, it, expect } from "vitest";
import {
  COMPRESS_ABOVE_BYTES,
  MAX_IMAGE_EDGE,
  isShrinkableImage,
  scaledDimensions,
  shouldCompress,
} from "@/lib/image";

describe("scaledDimensions", () => {
  it("leaves an image that is already small alone", () => {
    expect(scaledDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("scales the longest edge down, keeping the aspect ratio", () => {
    expect(scaledDimensions(4000, 3000)).toEqual({
      width: MAX_IMAGE_EDGE,
      height: 1200,
    });
    expect(scaledDimensions(3000, 4000)).toEqual({
      width: 1200,
      height: MAX_IMAGE_EDGE,
    });
  });

  it("handles a portrait phone photo", () => {
    // A typical 12MP phone camera shot, held upright.
    expect(scaledDimensions(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never rounds an edge away to zero", () => {
    const { width, height } = scaledDimensions(10000, 3, 1600);
    expect(width).toBe(1600);
    expect(height).toBe(1);
  });

  it("does not divide by zero on an empty image", () => {
    expect(scaledDimensions(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe("isShrinkableImage", () => {
  it("recognises images by type", () => {
    expect(isShrinkableImage("image/jpeg", "a.jpg")).toBe(true);
    expect(isShrinkableImage("image/png", "a.png")).toBe(true);
  });

  it("recognises images by name when the browser reports no type", () => {
    expect(isShrinkableImage("", "receipt.JPEG")).toBe(true);
    expect(isShrinkableImage("", "receipt.webp")).toBe(true);
  });

  it("leaves PDFs alone — they cannot be re-encoded here", () => {
    expect(isShrinkableImage("application/pdf", "statement.pdf")).toBe(false);
    expect(isShrinkableImage("", "statement.pdf")).toBe(false);
  });
});

describe("shouldCompress", () => {
  it("shrinks a large photo", () => {
    expect(
      shouldCompress({
        type: "image/jpeg",
        name: "IMG_2026.jpg",
        size: 4 * 1024 * 1024,
      }),
    ).toBe(true);
  });

  it("leaves a small screenshot as it is", () => {
    expect(
      shouldCompress({
        type: "image/png",
        name: "screenshot.png",
        size: COMPRESS_ABOVE_BYTES - 1,
      }),
    ).toBe(false);
  });

  it("never touches a PDF, however large", () => {
    expect(
      shouldCompress({
        type: "application/pdf",
        name: "statement.pdf",
        size: 4 * 1024 * 1024,
      }),
    ).toBe(false);
  });
});
