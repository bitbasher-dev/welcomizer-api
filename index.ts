import fetch from "node-fetch";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { CONFIG } from "./config";
import { PrismaClient } from "@prisma/client";
import { initializeApp } from "firebase/app";
import { customAlphabet } from "nanoid";
import { getStorage, ref, listAll } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2Mb8kPg-9F9zUofSRDORCctg0v5v7gyg",
  authDomain: "welcomizer-dev.firebaseapp.com",
  databaseURL: "https://welcomizer-dev.firebaseio.com",
  projectId: "welcomizer-dev",
  storageBucket: "welcomizer-dev.appspot.com",
  messagingSenderId: "859585679554",
  appId: "1:859585679554:web:7670b8dfe0d66fe9dd2b5b",
  measurementId: "G-NNKJYLC930",
};

// Initialize Firebase
const firebase = initializeApp(firebaseConfig);
const storage = getStorage(firebase);

// Create a reference under which you want to list
const listRef = ref(storage, "/");

const hashNanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_",
  6
);

const app = fastify();
app.register(fastifyCors);

const prisma = new PrismaClient();

async function run() {
  app.get("/ping", async (req, res) => {
    return {
      name: "Palhari, 2022",
      now: new Date(),
    };
  });

  app.post<{
    Body: {
      contactFirstName: string;
      contactLastName: string;
      contactEmail: string;
      appName: string;
    };
  }>("/notify", async (req, res) => {
    const { contactEmail, contactFirstName, contactLastName, appName } =
      req.body;

    const hash = hashNanoid();

    console.log(`Created video #${hash}`);

    const video = await prisma.videoNotification.create({
      data: {
        contactEmail,
        alreadyProcessed: false,
        hash,
      },
    });

    const response = await fetch(`https://fcm.googleapis.com/fcm/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${CONFIG.FIREBASE_CLOUD_MESSAGING_TOKEN}`,
      },
      body: JSON.stringify({
        registration_ids: [
          "d1Zr08xGZkKhkCr5OteHwM:APA91bGjw3pS5h63SemNGBjao1mvacajVt3b69VwfQWy6vNnvNR5pAgWmMJ6MuMB8WO1_szSTQghKQ43OuDhy7gKfHnR-2sVB74K8OZDJSTYC8bQ2i0AJWx5tlv8MsbQRCdVQAcMn9H-",
        ],
        notification: {
          title: "New opt-in!",
          body: `${contactFirstName ? `${contactFirstName} ` : ""}${
            contactLastName ? `${contactLastName} ` : `${contactEmail} `
          }just opted in to ${appName}`,
        },

        data: {
          videoId: `${video.id}_`,
        },
      }),
    });

    const responseJSON = await response.json();
    console.log({ responseJSON });

    return "ok";
  });

  // app.get("/video", async (req, res) => {});

  async function listVideos() {
    const response = await listAll(listRef);
    let allFiles: string[] = [];
    response.items.forEach((iRef) => allFiles.push(iRef.name));
    return allFiles;
  }

  async function listVideosTailCall(): Promise<NodeJS.Timeout> {
    console.log(`listVideosTailCall`);

    // Get all videos that are not done in the database
    let videosNotProcessed = await prisma.videoNotification.findMany({
      where: {
        alreadyProcessed: false,
      },
      select: {
        id: true,
      },
    });

    console.log(`Videos not processed: ${videosNotProcessed.length}`);

    // If there are no videos being processed, just quit
    if (videosNotProcessed.length === 0)
      return setTimeout(() => listVideosTailCall(), 15 * 1000);

    // Else, call the list videos and see if my video was already processed
    let files = await listVideos();
    console.log({ files });

    // Get all files that are processed now
    let videoIdsProcessed: string[] = [];

    videosNotProcessed.forEach((v) => {
      let isVideoProcessed = files.find((f) => f.split("_")[0] === v.id);
      if (isVideoProcessed) videoIdsProcessed.push(v.id);
    });

    // Mark videos processed as processed
    if (videoIdsProcessed.length > 0) {
      await prisma.videoNotification.updateMany({
        where: {
          id: { in: videoIdsProcessed },
        },
        data: {
          alreadyProcessed: true,
        },
      });
    }

    return setTimeout(() => listVideosTailCall(), 15 * 1000);
  }

  // Start tail call loop
  listVideosTailCall();

  // Start server
  await app.listen(5060);
  console.log(`Listening on https://localhost:5060`);
}

run();
