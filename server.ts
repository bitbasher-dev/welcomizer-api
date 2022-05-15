import fetch from "node-fetch";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { CONFIG, FIREBASE_SERVICE_ACCOUNT, USER_BM_KEY_MAP } from "./config";
import { PrismaClient } from "@prisma/client";
import { customAlphabet } from "nanoid";

import { initializeApp, cert, ServiceAccount } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import dayjs from "dayjs";

// function atob(a: string) {
//   return new Buffer(a, "base64").toString("binary");
// }

// function btoa(b: string) {
//   return new Buffer(b).toString("base64");
// }

const firebaseApp = initializeApp({
  credential: cert(FIREBASE_SERVICE_ACCOUNT as ServiceAccount),
  databaseURL: "https://welcomizer-dev.firebaseio.com",
  storageBucket: "welcomizer-dev.appspot.com",
});

const bucket = getStorage(firebaseApp).bucket();

const firestore = getFirestore(firebaseApp);

const hashNanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_",
  6
);

const app = fastify();
app.register(fastifyCors);

const prisma = new PrismaClient();

/**
 * Function that, given a Firebase User's Id, return an array of the user's FCM tokens
 * @param params
 * @returns
 */
async function getFirebaseFCMTokens(params: { firebaseUserId: string }) {
  const { firebaseUserId } = params;

  console.log({ firebaseUserId: `users/${firebaseUserId}` });

  let userRef = await firestore.doc(`users/${firebaseUserId}`).get();

  return userRef.data()?.fcmTokens as string[] | undefined;
}

async function run() {
  const prismaWalMode = await prisma.$queryRaw`
    pragma journal_mode = WAL;
    pragma synchronous = normal;
    pragma temp_store = memory;
    pragma mmap_size = 30000000000;
  `;

  console.log({ prismaWalMode });

  app.get("/ping", async () => {
    return {
      name: "Palhari, 2022",
      now: new Date(),
    };
  });

  // Route to be called from a BM campaign, triggers a notification
  // and creates an entry on the database with info to be conciliated once the video
  // finishes being recorded
  app.post<{
    Body: {
      contactFirstName: string;
      contactLastName: string;
      contactEmail: string;
      appName: string;
      firebaseUserId: string;
    };
  }>("/notify", async (req) => {
    const {
      contactEmail,
      contactFirstName,
      contactLastName,
      appName,
      firebaseUserId,
    } = req.body;

    const hash = hashNanoid();

    console.log(`Created video #${hash}`);

    const video = await prisma.videoNotification.create({
      data: {
        contactEmail,
        alreadyProcessed: false,
        hash,
        firebaseUserId,
      },
    });

    // Fires the notification to these tokens
    let registration_ids = await getFirebaseFCMTokens({
      firebaseUserId,
    });

    registration_ids = registration_ids?.filter((r) => r);

    if (!registration_ids) {
      console.log("No registration ids!");
      return "partial-ok";
    }

    const response = await fetch(`https://fcm.googleapis.com/fcm/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${CONFIG.FIREBASE_CLOUD_MESSAGING_TOKEN}`,
      },
      body: JSON.stringify({
        registration_ids,
        notification: {
          title: "New opt-in!",
          body: `${contactFirstName ? `${contactFirstName} ` : ""}${
            contactLastName ? `${contactLastName} ` : `${contactEmail} `
          }just opted in to ${appName}`,
        },

        data: {
          // Here, the video will be stored in firebase as ${videoId}_${timestamp}.${extension}
          videoId: `${video.id}_`,
        },
      }),
    });

    const responseJSON = await response.json();
    console.log(JSON.stringify({ responseJSON }));

    return "ok";
  });

  // Function to be called from Firebase once the video finishes processing
  app.get<{ Querystring: { videoId: string; videoFileName: string } }>(
    "/video_processed",
    async (req) => {
      const { videoId, videoFileName } = req.query;

      // Get the video that was recorded
      let videoProcessed = await prisma.videoNotification.update({
        where: {
          id: videoId,
        },
        data: {
          alreadyProcessed: true,
          finalVideoName: videoFileName,
        },
      });

      // Send the email to the contact
      await sendVideoToBMContact({
        videoId: videoProcessed.id,
        welcomizerVideoURL: `https://video.welcomizer.com/?video=${videoProcessed.hash}`,
      });

      return "ok";
    }
  );

  /**
   * To be consumed from the Frontend, to visualize videos
   */
  app.get<{ Params: { hash: string } }>("/video/:hash", async (req, res) => {
    const { hash } = req.params;

    const video = await prisma.videoNotification.findFirst({
      where: {
        hash,
      },
    });

    if (!video) {
      return res.status(404).send({ msg: `Video not found with hash ${hash}` });
    }

    // USE FIREBASE ADMIN
    let url = await bucket.file(`${video.finalVideoName}`).getSignedUrl({
      action: "read",
      expires: dayjs().add(15, "minutes").toDate(),
    });
    // let url = await getDownloadURL(ref(storage, `/${video.finalVideoName}`));

    console.log(url[0]);

    res.redirect(302, url[0]);
  });

  async function sendVideoToBMContact(params: {
    videoId: string;
    welcomizerVideoURL: string;
  }) {
    const { videoId, welcomizerVideoURL } = params;

    const video = await prisma.videoNotification.findFirst({
      where: {
        id: videoId,
      },
    });

    if (!video) return;
    const USER_CONFIG = USER_BM_KEY_MAP[video.firebaseUserId];

    let response = await fetch(
      `https://api.berserkermail.com/external-api/contact`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_CONFIG.BM_API_KEY}`,
        },
        body: JSON.stringify({
          email: video.contactEmail,
          customFields: {
            welcomizerVideoURL,
          },
          tags: [USER_CONFIG.BM_SEND_VIDEO_START_TAG],
        }),
      }
    );

    console.log(await response.json());
  }

  // Start server
  await app.listen(5060);
  console.log(`Listening on https://localhost:5060`);
}

run();
