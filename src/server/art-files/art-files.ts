import type { Clock } from "../clock.js";
import type { Database } from "../database.js";
import { isId } from "../ids.js";

/** The picture types that can be uploaded, as content types. */
export const pictureTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"] as const;
export type PictureType = (typeof pictureTypes)[number];

/** The largest picture that can be uploaded. Sticker-sized art is far smaller. */
export const largestPicture = 1024 * 1024;

/** What a file really is, from its first bytes, whatever it claims to be. Undefined if it isn't a picture we take. */
export function pictureTypeOf(bytes: Buffer): PictureType | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  // An SVG is text: allow a byte-order mark, an XML declaration, comments and a doctype before the <svg> element.
  const start = bytes.subarray(0, 2048).toString("utf8").replace(/^﻿/, "");
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i.test(start)) return "image/svg+xml";
  return undefined;
}

/**
 * Uploaded pictures (the art-files module). They're kept in the database for now; moving them to a bucket would change
 * only this module. A picture never changes once saved: a new picture is a new id, so it can be cached for good.
 */
export function createArtFiles(db: Database, clock: Clock) {
  return {
    async save(chartId: string, contentType: PictureType, bytes: Buffer): Promise<{ id: string; url: string }> {
      const { id } = await db
        .insertInto("art_files")
        .values({ chart_id: chartId, content_type: contentType, bytes, created_at: clock.now() })
        .returning("id")
        .executeTakeFirstOrThrow();
      return { id, url: artFileUrl(id) };
    },

    async get(id: string): Promise<{ contentType: string; bytes: Buffer } | undefined> {
      if (!isId(id)) return undefined;
      const file = await db.selectFrom("art_files").select(["content_type", "bytes"]).where("id", "=", id).executeTakeFirst();
      return file && { contentType: file.content_type, bytes: file.bytes };
    },

    /** Whether a picture was uploaded to this chart. */
    async belongsTo(chartId: string, id: string): Promise<boolean> {
      if (!isId(id)) return false;
      return Boolean(await db.selectFrom("art_files").select("id").where("id", "=", id).where("chart_id", "=", chartId).executeTakeFirst());
    },
  };
}

export function artFileUrl(id: string): string {
  return `/api/art-files/${id}`;
}

export type ArtFiles = ReturnType<typeof createArtFiles>;
