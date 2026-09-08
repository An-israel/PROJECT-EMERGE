import { describe, it, expect } from "vitest";
import {
  fileExtension,
  inferMimeType,
  isOwnObjectPath,
  objectNameFor,
  receiptObjectPath,
} from "@/lib/upload";
import { validateFile, MAX_FILE_BYTES } from "@/lib/validation";

const USER = "8f2b1c44-0d3a-4c9e-9d21-6a1b2c3d4e5f";
const OTHER = "11111111-2222-3333-4444-555555555555";

describe("fileExtension", () => {
  it("reads the extension, lowercased", () => {
    expect(fileExtension("Receipt.JPG")).toBe("jpg");
    expect(fileExtension("scan.2026.08.pdf")).toBe("pdf");
  });

  it("is empty when there is no extension", () => {
    expect(fileExtension("receipt")).toBe("");
  });

  it("strips anything that is not a letter or digit", () => {
    expect(fileExtension("receipt.p n g!")).toBe("png");
  });
});

describe("inferMimeType", () => {
  it("trusts the browser when it reports a type", () => {
    expect(inferMimeType("receipt.png", "image/png")).toBe("image/png");
  });

  it("falls back to the extension when the browser reports nothing", () => {
    // Some Android file pickers hand over an empty type.
    expect(inferMimeType("receipt.jpg", "")).toBe("image/jpeg");
    expect(inferMimeType("receipt.pdf", "  ")).toBe("application/pdf");
  });

  it("gives up rather than guessing on an unknown extension", () => {
    expect(inferMimeType("receipt.xyz", "")).toBe("");
  });
});

describe("receiptObjectPath", () => {
  it("puts the file in the user's own folder", () => {
    const path = receiptObjectPath(USER, "receipt.jpg", "image/jpeg", 1700);
    expect(path).toBe(`${USER}/1700-receipt.jpg`);
  });

  it("recovers an extension from the type when the name has none", () => {
    const path = receiptObjectPath(USER, "receipt", "application/pdf", 1700);
    expect(path).toBe(`${USER}/1700-receipt.pdf`);
  });

  it("falls back to .dat when neither name nor type says anything", () => {
    expect(receiptObjectPath(USER, "receipt", "", 1700)).toBe(
      `${USER}/1700-receipt.dat`,
    );
  });
});

describe("isOwnObjectPath", () => {
  it("accepts a path in the user's own folder", () => {
    expect(isOwnObjectPath(`${USER}/1700-receipt.jpg`, USER)).toBe(true);
  });

  it("rejects another partner's folder", () => {
    expect(isOwnObjectPath(`${OTHER}/1700-receipt.jpg`, USER)).toBe(false);
  });

  it("rejects traversal, nesting, and absolute paths", () => {
    expect(isOwnObjectPath(`${USER}/../${OTHER}/x.jpg`, USER)).toBe(false);
    expect(isOwnObjectPath(`${USER}/sub/x.jpg`, USER)).toBe(false);
    expect(isOwnObjectPath(`/${USER}/x.jpg`, USER)).toBe(false);
    expect(isOwnObjectPath(`${USER}/`, USER)).toBe(false);
    expect(isOwnObjectPath("", USER)).toBe(false);
  });
});

describe("objectNameFor", () => {
  it("returns the file name for the user's own path", () => {
    expect(objectNameFor(`${USER}/1700-receipt.jpg`, USER)).toBe(
      "1700-receipt.jpg",
    );
  });

  it("returns null for anyone else's path", () => {
    expect(objectNameFor(`${OTHER}/1700-receipt.jpg`, USER)).toBeNull();
  });
});

describe("validateFile", () => {
  it("accepts the formats partners actually send", () => {
    for (const type of [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]) {
      expect(validateFile({ type, size: 1024 }), type).toBeNull();
    }
  });

  it("accepts a file whose type the browser did not report", () => {
    expect(
      validateFile({ type: "", size: 1024, name: "receipt.jpg" }),
    ).toBeNull();
  });

  it("rejects an unsupported type", () => {
    expect(validateFile({ type: "text/plain", size: 10, name: "a.txt" })).toBe(
      "File must be a JPEG, PNG, WEBP, or PDF.",
    );
  });

  it("rejects a file over the size limit", () => {
    expect(
      validateFile({ type: "image/jpeg", size: MAX_FILE_BYTES + 1 }),
    ).toBe("File must be 5MB or smaller.");
  });

  it("accepts a file exactly on the limit", () => {
    expect(validateFile({ type: "image/jpeg", size: MAX_FILE_BYTES })).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateFile({ type: "image/jpeg", size: 0 })).toBe(
      "That file is empty. Please choose your receipt again.",
    );
  });
});
