import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { STORAGE } from "@/lib/footage/store";
import { isFootageFile } from "@/lib/footage/types";
import { isStudioFile, kindOf } from "@/lib/studio/paths";

// Raw footage goes from the browser straight into the private Blob store; this
// route only signs the upload. (A function's 4.5 MB body limit would rule out
// sending video through here.) The sign-in in proxy.ts guards it.
export async function POST(req: Request) {
  if (STORAGE !== "blob") return Response.json({ error: "Blob storage isn't connected here." }, { status: 400 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Studio's fonts and music use the same signed upload, each with its own types and size.
        if (isStudioFile(pathname)) {
          const fonts = kindOf(pathname) === "fonts";
          return {
            allowedContentTypes: fonts
              ? ["font/*", "application/font-woff", "application/x-font-ttf", "application/x-font-otf", "application/vnd.ms-opentype", "application/octet-stream"]
              : ["audio/*"],
            maximumSizeInBytes: fonts ? 20 * 1024 ** 2 : 500 * 1024 ** 2,
            addRandomSuffix: false,
            allowOverwrite: true,
          };
        }
        if (!isFootageFile(pathname)) throw new Error("Uploads go under footage/files/.");
        return {
          allowedContentTypes: ["video/*"],
          maximumSizeInBytes: 50 * 1024 ** 3,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
