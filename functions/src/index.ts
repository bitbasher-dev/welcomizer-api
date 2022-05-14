import * as functions from "firebase-functions";
import fetch from "node-fetch";
import qs from "query-string";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.generateThumbnail = functions.storage
  .object()
  .onFinalize(async (object) => {
    const fileBucket = object.bucket; // The Storage bucket that contains the file.
    const filePath = object.name; // File path in the bucket.
    const contentType = object.contentType; // File content type.
    const metageneration = object.metageneration; // Number of times metadata has been generated. New objects have a value of 1.
    // ...

    console.log({ filePath });

    if (!filePath) return;

    // cuid videos should start with c
    if (!filePath.startsWith("c")) return;

    // If the filePath has "/" it's a subfile, for now, should be dead
    if (filePath.includes("/")) return;

    const videoFileName = filePath;
    const [videoId] = videoFileName.split("_");

    console.log({videoId, videoFileName})

    let query = qs.stringify({ videoId, videoFileName });

    // Notify the API that the video is done!
    await fetch(`https://api.welcomizer.com/video_processed?${query}`);
  });
